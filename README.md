# exiftool-vendored.pl

Provides the perl runtime distribution of [ExifTool](https://exiftool.org/) to
[node](https://nodejs.org/en/). As of version `10.38.0`, both testing and help
files are omitted, as they almost double the size of the package and more than
triple the number of files in the package.

[![npm version](https://img.shields.io/npm/v/exiftool-vendored.pl.svg)](https://www.npmjs.com/package/exiftool-vendored.pl)
[![Node.js CI](https://github.com/photostructure/exiftool-vendored.pl/actions/workflows/node.js.yml/badge.svg)](https://github.com/photostructure/exiftool-vendored.pl/actions/workflows/node.js.yml)

## Usage

**See [exiftool-vendored](https://github.com/photostructure/exiftool-vendored.js) for
performant, type-safe access to this binary.**

## Versioning

This package exposes the version of ExifTool it vendors, and adds a patch
number, if necessary, to follow SemVer.

### Version Update Process

1. The `check-updates` workflow automatically detects new ExifTool versions and creates PRs
2. Update PRs use a `-pre` suffix during development (e.g., `13.26.0-pre`)
3. The `release` workflow removes the `-pre` suffix when publishing to npm
4. Final npm package versions match the vendored ExifTool version exactly