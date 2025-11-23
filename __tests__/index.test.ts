import { parseMultilineInput, determineSemverBump } from '../src/index'

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  setFailed: jest.fn(),
  getInput: jest.fn(),
  setOutput: jest.fn()
}))

describe('parseMultilineInput', () => {
  test('parses multiline input correctly', () => {
    const input = 'major\nbreaking\nbreaking-change'
    const result = parseMultilineInput(input)
    expect(result).toEqual(['major', 'breaking', 'breaking-change'])
  })

  test('handles input with extra whitespace', () => {
    const input = '  major  \n  breaking  \n  breaking-change  '
    const result = parseMultilineInput(input)
    expect(result).toEqual(['major', 'breaking', 'breaking-change'])
  })

  test('filters out empty lines', () => {
    const input = 'major\n\nbreaking\n  \nbreaking-change'
    const result = parseMultilineInput(input)
    expect(result).toEqual(['major', 'breaking', 'breaking-change'])
  })

  test('handles empty input', () => {
    const input = ''
    const result = parseMultilineInput(input)
    expect(result).toEqual([])
  })
})

describe('determineSemverBump', () => {
  test('returns "major" when a PR has a major label', () => {
    const prs = [
      {
        number: 1,
        labels: { nodes: [{ name: 'breaking' }] }
      }
    ]
    const result = determineSemverBump(prs, ['breaking'], ['feature'], ['fix'])
    expect(result).toBe('major')
  })

  test('returns "minor" when a PR has a minor label and no major', () => {
    const prs = [
      {
        number: 1,
        labels: { nodes: [{ name: 'feature' }] }
      }
    ]
    const result = determineSemverBump(prs, ['breaking'], ['feature'], ['fix'])
    expect(result).toBe('minor')
  })

  test('returns "patch" when a PR has a patch label and no major or minor', () => {
    const prs = [
      {
        number: 1,
        labels: { nodes: [{ name: 'fix' }] }
      }
    ]
    const result = determineSemverBump(prs, ['breaking'], ['feature'], ['fix'])
    expect(result).toBe('patch')
  })

  test('returns "none" when no PRs have matching labels', () => {
    const prs = [
      {
        number: 1,
        labels: { nodes: [{ name: 'documentation' }] }
      }
    ]
    const result = determineSemverBump(prs, ['breaking'], ['feature'], ['fix'])
    expect(result).toBe('none')
  })

  test('prioritizes major over minor and patch', () => {
    const prs = [
      {
        number: 1,
        labels: { nodes: [{ name: 'feature' }] }
      },
      {
        number: 2,
        labels: { nodes: [{ name: 'breaking' }] }
      },
      {
        number: 3,
        labels: { nodes: [{ name: 'fix' }] }
      }
    ]
    const result = determineSemverBump(prs, ['breaking'], ['feature'], ['fix'])
    expect(result).toBe('major')
  })

  test('prioritizes minor over patch', () => {
    const prs = [
      {
        number: 1,
        labels: { nodes: [{ name: 'fix' }] }
      },
      {
        number: 2,
        labels: { nodes: [{ name: 'feature' }] }
      }
    ]
    const result = determineSemverBump(prs, ['breaking'], ['feature'], ['fix'])
    expect(result).toBe('minor')
  })

  test('handles multiple labels on a single PR', () => {
    const prs = [
      {
        number: 1,
        labels: {
          nodes: [{ name: 'feature' }, { name: 'documentation' }]
        }
      }
    ]
    const result = determineSemverBump(prs, ['breaking'], ['feature'], ['fix'])
    expect(result).toBe('minor')
  })

  test('handles empty PR list', () => {
    const prs: Array<{ number: number; labels: { nodes: { name: string }[] } }> =
      []
    const result = determineSemverBump(prs, ['breaking'], ['feature'], ['fix'])
    expect(result).toBe('none')
  })

  test('supports multiple labels in each category', () => {
    const prs = [
      {
        number: 1,
        labels: { nodes: [{ name: 'enhancement' }] }
      }
    ]
    const result = determineSemverBump(
      prs,
      ['breaking', 'major'],
      ['feature', 'enhancement', 'minor'],
      ['fix', 'bugfix', 'patch']
    )
    expect(result).toBe('minor')
  })
})
