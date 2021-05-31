# exiftool-vendored.pl

Provides the perl runtime distribution of [ExifTool](https://exiftool.org/) to
[node](https://nodejs.org/en/). As of version `10.38.0`, both testing and help
files are omitted, as they almost double the size of the package and more than
triple the number of files in the package.

[![npm version](https://img.shields.io/npm/v/exiftool-vendored.pl.svg)](https://www.npmjs.com/package/exiftool-vendored.pl)
[![CI](https://github.com/photostructure/exiftool-vendored.pl/workflows/Node.js%20CI/badge.svg?branch=main)](https://github.com/photostructure/exiftool-vendored.pl/actions?query=workflow%3A%22Node.js+CI%22)

## Usage

**See [exiftool-vendored](https://github.com/photostructure/exiftool-vendored.js) for
performant, type-safe access to this binary.**

## Versioning

This package exposes the version of ExifTool it vendors, and adds a patch
number, if necessary, to follow SemVer.