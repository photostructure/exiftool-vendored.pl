#!/bin/bash -ex

# Updates to the latest version of exiftool.

EXIFTOOL_DIR="./.vendored/exiftool"

if [ ! -d "$EXIFTOOL_DIR" ]; then
  mkdir -p "$(dirname "$EXIFTOOL_DIR")"
  # Use HTTPS URL which works everywhere
  git clone https://github.com/exiftool/exiftool.git "$EXIFTOOL_DIR"
fi

(
  cd "$EXIFTOOL_DIR"
  git add .
  git stash -u
  git checkout master
  git pull
)

# Check if we need to update by comparing raw exiftool versions
VENDORED_VER=$("$EXIFTOOL_DIR/exiftool" -ver)

# Check if we have a local bin/exiftool to compare against
if [ -f "bin/exiftool" ]; then
  LOCAL_VER=$(bin/exiftool -ver)
  echo "Local ExifTool version: $LOCAL_VER"
  echo "Vendored ExifTool version: $VENDORED_VER"
  
  # Early exit if versions are the same
  if [ "$LOCAL_VER" = "$VENDORED_VER" ]; then
    echo "No-op: already up to date (version $LOCAL_VER)"
    exit 0
  fi
  
  echo "Updating ExifTool from $LOCAL_VER to $VENDORED_VER"
else
  echo "No local ExifTool found, installing version $VENDORED_VER"
fi

# Now copy the files since we know we need to update
rm -rf bin
mkdir -p bin
cp -rp "$EXIFTOOL_DIR"/* bin
rm -rf bin/t bin/html bin/windows_exiftool*

# Update the package version (exiftool never has a patch version, so we add .0-pre)
NPM_VER="${VENDORED_VER}.0-pre"
npm version --no-git-tag-version "$NPM_VER"
