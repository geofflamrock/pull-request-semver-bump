import * as core from '@actions/core'
import * as github from '@actions/github'

interface PullRequest {
  number: number
  labels: { nodes: { name: string }[] }
}

interface GraphQLTag {
  name: string
  target: {
    oid: string
    committedDate?: string
    target?: {
      oid: string
      committedDate?: string
    }
  }
}

interface GraphQLTagsResponse {
  repository: {
    refs: {
      nodes: GraphQLTag[]
    }
  }
}

interface GraphQLPRNode {
  number: number
  mergedAt?: string
  labels: {
    nodes: { name: string }[]
  }
}

interface GraphQLPRsResponse {
  repository: {
    pullRequests: {
      pageInfo: {
        hasNextPage: boolean
        endCursor: string
      }
      nodes: GraphQLPRNode[]
    }
  }
}

interface Tag {
  name: string
  target: {
    oid: string
    committedDate?: string
  }
}

async function run(): Promise<void> {
  try {
    // Get inputs
    const majorLabelsInput = core.getInput('major')
    const minorLabelsInput = core.getInput('minor')
    const patchLabelsInput = core.getInput('patch')
    const token = core.getInput('github-token')

    // Parse multiline inputs into arrays
    const majorLabels = parseMultilineInput(majorLabelsInput)
    const minorLabels = parseMultilineInput(minorLabelsInput)
    const patchLabels = parseMultilineInput(patchLabelsInput)

    core.info(`Major labels: ${majorLabels.join(', ')}`)
    core.info(`Minor labels: ${minorLabels.join(', ')}`)
    core.info(`Patch labels: ${patchLabels.join(', ')}`)

    // Initialize GitHub client
    const octokit = github.getOctokit(token)
    const { owner, repo } = github.context.repo

    // Get the most recent tag
    const mostRecentTag = await getMostRecentTag(octokit, owner, repo)

    if (!mostRecentTag) {
      core.info('No tags found in repository')
      core.setOutput('semver_bump', 'none')
      return
    }

    core.info(`Most recent tag: ${mostRecentTag.name}`)

    // Get merged PRs since the most recent tag
    const mergedPRs = await getMergedPRsSinceTag(
      octokit,
      owner,
      repo,
      mostRecentTag
    )

    core.info(
      `Found ${mergedPRs.length} merged PRs since ${mostRecentTag.name}`
    )

    // Determine semver bump based on labels
    const semverBump = determineSemverBump(
      mergedPRs,
      majorLabels,
      minorLabels,
      patchLabels
    )

    core.info(`Determined semver bump: ${semverBump}`)
    core.setOutput('semver_bump', semverBump)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed(String(error))
    }
  }
}

export function parseMultilineInput(input: string): string[] {
  return input
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
}

async function getMostRecentTag(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string
): Promise<Tag | null> {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        refs(refPrefix: "refs/tags/", first: 1, orderBy: {field: TAG_COMMIT_DATE, direction: DESC}) {
          nodes {
            name
            target {
              oid
              ... on Commit {
                committedDate
              }
              ... on Tag {
                target {
                  oid
                  ... on Commit {
                    committedDate
                  }
                }
              }
            }
          }
        }
      }
    }
  `

  const result = await octokit.graphql<GraphQLTagsResponse>(query, {
    owner,
    repo
  })
  const tags = result.repository.refs.nodes

  if (tags.length === 0) {
    return null
  }

  const tag = tags[0]

  // Handle both lightweight and annotated tags
  if (tag.target.committedDate) {
    return {
      name: tag.name,
      target: {
        oid: tag.target.oid,
        committedDate: tag.target.committedDate
      }
    }
  } else if (tag.target.target?.committedDate) {
    return {
      name: tag.name,
      target: {
        oid: tag.target.target.oid,
        committedDate: tag.target.target.committedDate
      }
    }
  }

  // Fallback if date is not available
  return {
    name: tag.name,
    target: {
      oid: tag.target.oid
    }
  }
}

async function getMergedPRsSinceTag(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  tag: Tag
): Promise<PullRequest[]> {
  const tagDate = tag.target.committedDate

  if (!tagDate) {
    core.warning('Tag date not available, using all merged PRs')
  }

  const query = `
    query($owner: String!, $repo: String!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        pullRequests(first: 100, states: MERGED, orderBy: {field: UPDATED_AT, direction: DESC}, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            number
            mergedAt
            labels(first: 50) {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `

  const allPRs: PullRequest[] = []
  let hasNextPage = true
  let cursor: string | undefined

  while (hasNextPage) {
    const result = await octokit.graphql<GraphQLPRsResponse>(query, {
      owner,
      repo,
      cursor
    })
    const prs = result.repository.pullRequests.nodes

    for (const pr of prs) {
      // If we have a tag date, only include PRs merged after it
      if (tagDate && pr.mergedAt && pr.mergedAt <= tagDate) {
        hasNextPage = false
        break
      }

      allPRs.push({
        number: pr.number,
        labels: pr.labels
      })
    }

    hasNextPage =
      hasNextPage && result.repository.pullRequests.pageInfo.hasNextPage
    cursor = result.repository.pullRequests.pageInfo.endCursor
  }

  return allPRs
}

export function determineSemverBump(
  prs: PullRequest[],
  majorLabels: string[],
  minorLabels: string[],
  patchLabels: string[]
): string {
  let hasMajor = false
  let hasMinor = false
  let hasPatch = false

  for (const pr of prs) {
    const prLabelNames = pr.labels.nodes.map(label => label.name)

    // Check for major labels in this PR
    const hasMajorLabel = majorLabels.some(label =>
      prLabelNames.includes(label)
    )
    if (hasMajorLabel) {
      hasMajor = true
      const matchedLabel = majorLabels.find(label =>
        prLabelNames.includes(label)
      )
      core.info(`PR #${pr.number} has major label: ${matchedLabel}`)
      // Early exit - major is highest priority
      break
    }

    // Check for minor labels in this PR
    const hasMinorLabel = minorLabels.some(label =>
      prLabelNames.includes(label)
    )
    if (hasMinorLabel) {
      hasMinor = true
      const matchedLabel = minorLabels.find(label =>
        prLabelNames.includes(label)
      )
      core.info(`PR #${pr.number} has minor label: ${matchedLabel}`)
    }

    // Check for patch labels in this PR
    const hasPatchLabel = patchLabels.some(label =>
      prLabelNames.includes(label)
    )
    if (hasPatchLabel) {
      hasPatch = true
      const matchedLabel = patchLabels.find(label =>
        prLabelNames.includes(label)
      )
      core.info(`PR #${pr.number} has patch label: ${matchedLabel}`)
    }
  }

  if (hasMajor) {
    return 'major'
  } else if (hasMinor) {
    return 'minor'
  } else if (hasPatch) {
    return 'patch'
  } else {
    return 'none'
  }
}

run()
