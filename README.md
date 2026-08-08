# exiftool-vendored.pl

Provides the perl runtime distribution of [ExifTool](https://exiftool.org/) to
[node](https://nodejs.org/en/). As of version `10.38.0`, both testing and help
files are omitted, as they almost double the size of the package and more than
triple the number of files in the package.

[![npm version](https://img.shields.io/npm/v/exiftool-vendored.pl.svg)](https://www.npmjs.com/package/exiftool-vendored.pl)
[![Build](https://github.com/photostructure/exiftool-vendored.pl/actions/workflows/build.yml/badge.svg)](https://github.com/photostructure/exiftool-vendored.pl/actions/workflows/build.yml)

## Usage

**See [exiftool-vendored](https://github.com/photostructure/exiftool-vendored.js) for
performant, type-safe access to this binary.**

## Vendor patches

The vendored payload includes downstream changes from every
[`patches/*.patch`](https://github.com/photostructure/exiftool-vendored.pl/tree/main/patches)
file. The update script applies them in lexical filename order after verifying
and extracting the official ExifTool archive. Patch application uses zero
fuzz, so every context line in each hunk must match exactly. If those context
lines change upstream, the update fails instead of applying the patch
approximately. The manifest records a hash of the ordered patch set.
When no downstream changes are required, `patches/` may be absent and the
manifest records the SHA-256 fingerprint of the empty patch set.

The current
[`exiftool-stdin-eof.patch`](https://github.com/photostructure/exiftool-vendored.pl/blob/main/patches/exiftool-stdin-eof.patch)
makes stay-open ExifTool exit when its piped or socket stdin closes, while
preserving append-after-EOF polling for regular files. The change is
[reported upstream in exiftool/exiftool#458](https://github.com/exiftool/exiftool/issues/458)
but is not yet included in a released ExifTool version.

If an ExifTool update causes a patch to fail, review the upstream change. Then
refresh the patch if it is still needed, or remove it if upstream now provides
the same behavior. Removing the final patch may also remove `patches/`. Do not
relax the patch options or bypass the failure. Run the full test suite and
commit the patch, vendored source, and manifest changes together.

## Versioning

This package exposes the version of ExifTool it vendors, and adds a patch
number, if necessary, to follow SemVer.
