# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js package that vendors the Perl ExifTool binary for non-Windows
systems. It provides the ExifTool executable as an npm package, making it easily
installable for Node.js projects that need to work with image metadata.

## Key Commands

- `make preflight` - Everything that should pass before a release (also `npm run preflight`)
- `npm test` - Run the test suite to verify ExifTool is working correctly
- `npm run fmt` - Format repository files using Prettier
- `npm run update:exiftool` - Update ExifTool from its official archive

## Development Tasks

### Updating ExifTool Version

GitHub Actions detects ExifTool updates but does not modify the repository:

- The read-only `check-updates` workflow runs daily and fails when it finds a new version
- To manually check for updates, trigger the workflow from the default branch
- Apply the update on a maintainer workstation, review and commit it, then follow `RELEASING.md`

Manual update process (if needed):

1. Run `npm run update:exiftool`, which executes `update-exiftool.sh`
2. The script will:
   - Download the official source archive and published checksum metadata
   - Verify the archive SHA-256 and byte size before extraction
   - Extract the verified archive into a staging directory
   - Apply every `patches/*.patch` file in lexical filename order with zero fuzz
   - Replace `bin/` only after every patch applies successfully
   - Remove unnecessary files (tests, help files, Windows executables)
   - Record the upstream artifact and ordered patch-set hashes in `vendor-manifest.json`
   - Set the package version to match ExifTool's version with `-pre` suffix
3. After committing changes, use the staged release process in `RELEASING.md`

If strict patch application fails, do not add fuzz or bypass the patch. Compare
the patch with the new upstream source. Refresh the patch if the downstream
behavior is still required, or remove it if upstream provides equivalent
behavior. Then rerun the update and the full test suite before committing the
patch, `bin/`, and `vendor-manifest.json` changes together. If no downstream
patches remain, `patches/` may be absent; the updater treats that as an empty
patch set and installs the verified upstream source unchanged.

### Testing

Tests are written with Mocha and verify that:

- The vendored ExifTool binary executes with the expected version and no stderr
- Stay-open ExifTool exits on pipe or socket EOF
- Regular-file inputs retain append-after-EOF polling
- `vendor-manifest.json` matches the upstream artifact and ordered patch set

Run tests with: `npm test`

## Architecture

The package is minimal:

- `index.js` - Exports the path to the ExifTool binary
- `bin/exiftool` - The vendored ExifTool Perl script
- `lib/vendor-patch-set.js` - Discovers and hashes the ordered patch series
- `patches/` - Downstream changes; may be absent when none are required
- `update-exiftool.sh` - Verifies, patches, and installs the official source archive
- `vendor-manifest.json` - Records the verified upstream artifact and patch-set hashes

## Release Process

Releases use two GitHub Actions workflows and npm staged publishing:

1. Trigger the workflow manually from the Actions tab
2. Choose the validated patch, minor, or major version operation
3. The workflow will:
   - Run the full test gate
   - Create a signed release commit and annotated tag
   - Validate and pack the exact tagged source
   - Stage the package on npm for maintainer inspection and 2FA approval
   - Create an immutable GitHub release

Version numbers follow the ExifTool version with an additional patch number when needed for package-specific changes.
