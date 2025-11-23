# pull-request-semver-bump

Action to get the next semver bump from pull request labels

## Description

This GitHub Action analyzes merged pull requests since the most recent tag and determines the appropriate semantic version bump based on PR labels.

## Usage

```yaml
name: Determine Semver Bump
on: [push]

jobs:
  semver:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required to fetch all tags

      - name: Determine Semver Bump
        id: semver
        uses: geofflamrock/pull-request-semver-bump@v1
        with:
          major: |
            breaking
            major
          minor: |
            feature
            enhancement
            minor
          patch: |
            bugfix
            fix
            patch
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Use the output
        run: echo "Semver bump is ${{ steps.semver.outputs.semver_bump }}"
```

## Inputs

### `major`

**Optional** Multiline list of PR labels that represent a major semver bump.

Default: `''`

### `minor`

**Optional** Multiline list of PR labels that represent a minor semver bump.

Default: `''`

### `patch`

**Optional** Multiline list of PR labels that represent a patch semver bump.

Default: `''`

### `github-token`

**Optional** GitHub token for API access.

Default: `${{ github.token }}`

## Outputs

### `semver_bump`

The determined semver bump. Possible values:
- `major` - A breaking change that requires a major version bump
- `minor` - A new feature that requires a minor version bump
- `patch` - A bug fix that requires a patch version bump
- `none` - No semver bump required

## How It Works

1. The action uses the GitHub GraphQL API to fetch the most recent tag in the repository
2. It then queries all merged pull requests since that tag
3. For each merged PR, it checks the labels against the provided input lists
4. The action determines the semver bump based on priority: major > minor > patch
5. If a PR has multiple labels, the highest priority bump is chosen
6. The result is output as `semver_bump`

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Format

```bash
npm run format
```

## License

MIT

