#!/bin/bash

set -euo pipefail

# Download the latest portable Perl ExifTool source archive, verify it against
# Phil Harvey's independently published checksum, and record the exact upstream
# artifact before updating the vendored tree.

VENDOR_DIR=".vendored"
RSS_FILE="$VENDOR_DIR/rss.xml"
CHECKSUM_FILE="$VENDOR_DIR/checksums.txt"

mkdir -p "$VENDOR_DIR"

VENDORED_VER="$({
  node -e '
    require("./lib/version-utils")
      .getLatestExifToolVersion()
      .then((version) => process.stdout.write(version.replace(/\.0$/, "")))
      .catch((error) => {
        console.error(error)
        process.exit(1)
      })
  '
})"

FILENAME="Image-ExifTool-$VENDORED_VER.tar.gz"
curl --fail --location --retry 3 --output "$RSS_FILE" https://exiftool.org/rss.xml
curl --fail --location --retry 3 --output "$CHECKSUM_FILE" https://exiftool.org/checksums.txt

ENCLOSURE_LINE="$(grep -F "$FILENAME" "$RSS_FILE" | head -n 1)"
SOURCE_URL="$(printf '%s\n' "$ENCLOSURE_LINE" | sed -n "s/.*url='\([^']*\)'.*/\1/p")"
EXPECTED_SIZE="$(printf '%s\n' "$ENCLOSURE_LINE" | sed -n "s/.*length='\([0-9][0-9]*\)'.*/\1/p")"
EXPECTED_SHA256="$(
  grep -F "SHA2-256($FILENAME)=" "$CHECKSUM_FILE" |
    head -n 1 |
    sed -n 's/.*=[[:space:]]*\([0-9a-f][0-9a-f]*\).*/\1/p'
)"

if [[ -z "$SOURCE_URL" || ! "$EXPECTED_SIZE" =~ ^[0-9]+$ ]]; then
  echo "Could not resolve the official artifact URL and size for $FILENAME" >&2
  exit 1
fi
if [[ ! "$EXPECTED_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Could not resolve the published SHA-256 for $FILENAME" >&2
  exit 1
fi

PACKAGE_VERSION_REPAIR="$(
  VENDOR_VERSION="$VENDORED_VER" node <<'NODE'
const { requiredPackageVersionRepair } = require("./lib/package-version")
const pkg = require("./package.json")
const lock = require("./package-lock.json")

process.stdout.write(
  requiredPackageVersionRepair(pkg.version, lock, process.env.VENDOR_VERSION) ??
    "",
)
NODE
)"

PAYLOAD_CURRENT=false
LOCAL_VER=""
if [[ -x bin/exiftool && -f vendor-manifest.json ]]; then
  LOCAL_VER="$(bin/exiftool -ver)"
  if [[ "$LOCAL_VER" == "$VENDORED_VER" ]] &&
    VENDOR_VERSION="$VENDORED_VER" \
      VENDOR_SOURCE_URL="$SOURCE_URL" \
      VENDOR_FILENAME="$FILENAME" \
      VENDOR_SIZE="$EXPECTED_SIZE" \
      VENDOR_SHA256="$EXPECTED_SHA256" \
      node <<'NODE'
const { matchesVendorManifest } = require("./lib/vendor-manifest")

const expected = {
  version: process.env.VENDOR_VERSION,
  sourceUrl: process.env.VENDOR_SOURCE_URL,
  platform: "non-win32",
  architecture: "any",
  filename: process.env.VENDOR_FILENAME,
  size: Number(process.env.VENDOR_SIZE),
  sha256: process.env.VENDOR_SHA256,
}

let actual
try {
  actual = require("./vendor-manifest.json")
} catch {
  process.exit(1)
}

process.exit(matchesVendorManifest(actual, expected) ? 0 : 1)
NODE
  then
    PAYLOAD_CURRENT=true
  fi
fi

if [[ "$PAYLOAD_CURRENT" == true && -z "$PACKAGE_VERSION_REPAIR" ]]; then
  echo "No-op: already up to date and verified (version $LOCAL_VER)"
  exit 0
fi

if [[ "$PAYLOAD_CURRENT" != true ]]; then
  ARCHIVE="$VENDOR_DIR/$FILENAME"
  curl --fail --location --retry 3 --output "$ARCHIVE" "$SOURCE_URL"

  ACTUAL_SIZE="$(wc -c < "$ARCHIVE" | tr -d '[:space:]')"
  if [[ "$ACTUAL_SIZE" != "$EXPECTED_SIZE" ]]; then
    echo "Unexpected size for $FILENAME: expected $EXPECTED_SIZE, got $ACTUAL_SIZE" >&2
    exit 1
  fi
  ARCHIVE_PATH="$ARCHIVE" ARCHIVE_SHA256="$EXPECTED_SHA256" node <<'NODE'
const { createHash } = require("node:crypto")
const { readFileSync } = require("node:fs")

const archivePath = process.env.ARCHIVE_PATH
const expected = process.env.ARCHIVE_SHA256
const actual = createHash("sha256")
  .update(readFileSync(archivePath))
  .digest("hex")
if (actual !== expected) {
  throw new Error(`SHA-256 mismatch for ${archivePath}: ${actual}`)
}
console.log(`${archivePath}: OK`)
NODE

  EXTRACT_DIR="$VENDOR_DIR/Image-ExifTool-$VENDORED_VER"
  rm -rf "$EXTRACT_DIR"
  tar -xzf "$ARCHIVE" -C "$VENDOR_DIR"
  if [[ ! -x "$EXTRACT_DIR/exiftool" ]]; then
    echo "The verified archive did not contain the expected ExifTool executable" >&2
    exit 1
  fi

  rm -rf bin
  cp -Rp "$EXTRACT_DIR" bin
  rm -rf bin/t bin/html bin/windows_exiftool*

  VENDOR_VERSION="$VENDORED_VER" \
  VENDOR_SOURCE_URL="$SOURCE_URL" \
  VENDOR_FILENAME="$FILENAME" \
  VENDOR_SIZE="$EXPECTED_SIZE" \
  VENDOR_SHA256="$EXPECTED_SHA256" \
    node <<'NODE'
const { writeFileSync } = require("node:fs")

const manifest = {
  version: process.env.VENDOR_VERSION,
  sourceUrl: process.env.VENDOR_SOURCE_URL,
  platform: "non-win32",
  architecture: "any",
  filename: process.env.VENDOR_FILENAME,
  size: Number(process.env.VENDOR_SIZE),
  sha256: process.env.VENDOR_SHA256,
}

writeFileSync("vendor-manifest.json", JSON.stringify(manifest, null, 2) + "\n")
NODE

  echo "Refreshed the vendored payload and manifest for version $VENDORED_VER"
fi

if [[ -n "$PACKAGE_VERSION_REPAIR" ]]; then
  echo "Updating package.json and package-lock.json to version $PACKAGE_VERSION_REPAIR"
  npm version --no-git-tag-version "$PACKAGE_VERSION_REPAIR" \
    --ignore-scripts --allow-same-version
fi
