# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-23

### Added
- Initial implementation of GitHub Action for determining semver bump from PR labels
- Support for multiline input of major, minor, and patch label configurations
- GraphQL API integration to fetch most recent tag and merged PRs
- Label evaluation logic with proper priority (major > minor > patch)
- Comprehensive test suite with 14 test cases
- TypeScript implementation with strict typing
- Complete documentation in README.md
- Example workflow demonstrating usage
- Support for both lightweight and annotated Git tags
- Pagination support for repositories with many PRs
- Proper error handling for all error types

### Security
- No known vulnerabilities in dependencies
- All production dependencies verified against GitHub Advisory Database
- Proper input validation and TypeScript typing
