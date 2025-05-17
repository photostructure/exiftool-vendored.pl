# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js package that vendors the Perl ExifTool binary for non-Windows
systems. It provides the ExifTool executable as an npm package, making it easily
installable for Node.js projects that need to work with image metadata.

## Key Commands

- `npm test` - Run the test suite to verify ExifTool is working correctly
- `npm run prettier` - Format test files using Prettier
- `npm run update` - Updates npm dependencies and runs the ExifTool update script

## Development Tasks

### Updating ExifTool Version

ExifTool updates are fully automated via GitHub Actions:
- The `check-updates` workflow runs weekly and creates PRs for new versions
- To manually check for updates: trigger the workflow from GitHub Actions tab
- After merging an update PR: trigger the `release` workflow to publish to npm

Manual update process (if needed):
1. Run `npm run update` which executes `update.sh`
2. The script will:
   - Clone or update the ExifTool repository in the parent directory
   - Copy the latest ExifTool files to `bin/`
   - Remove unnecessary files (tests, help files, Windows executables)
   - Set the package version to match ExifTool's version with `-pre` suffix
3. After committing changes, use the GitHub Actions release workflow to publish

### Testing

Tests are written with Mocha and verify that:
- The vendored ExifTool binary can be executed
- Version output is correctly formatted
- No stderr output is produced during normal operation

Run tests with: `npm test`

## Architecture

The package is minimal:
- `index.js` - Exports the path to the ExifTool binary
- `bin/exiftool` - The vendored ExifTool Perl script (not tracked in git)
- `update.sh` - Script to update ExifTool from the official repository

## Release Process

Releases are automated via the GitHub Actions `release` workflow:
1. Trigger the workflow manually from the Actions tab
2. Optionally specify version increment (auto-detects if not provided)
3. The workflow will:
   - Install dependencies
   - Run tests
   - Remove the `-pre` suffix from version numbers
   - Create GitHub release and git tags with GPG signing
   - Publish to npm

Version numbers follow the ExifTool version with an additional patch number when needed for package-specific changes.