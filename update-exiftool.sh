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

rm -rf bin
mkdir -p bin
cp -rp "$EXIFTOOL_DIR"/* bin
# Fix https://exiftool.org/forum/index.php?topic=16271.0
for i in bin/exiftool bin/build_geolocation; do
  sed '1 s/ -w$//' -i $i
done
rm -rf bin/t bin/html bin/windows_exiftool

# Check if we need to update the version
# exiftool never has a patch version:
VER=$(bin/exiftool -ver).0-pre
CURRENT_VER=$(node -p "require('./package.json').version")

echo "Current package version: $CURRENT_VER"
echo "ExifTool version: $VER"

# Are there pending updates?
if [ "$(git status --porcelain=v1 2>/dev/null | wc -l)" -eq 0 ] && [ "$CURRENT_VER" = "$VER" ]; then
  echo "No-op: already up to date"
elif [ "$CURRENT_VER" = "$VER" ]; then
  echo "Version is already up to date, but there are file changes to commit"
else
  echo "Updating package version from $CURRENT_VER to $VER"
  npm version --no-git-tag-version "$VER" || {
    if [ "$CURRENT_VER" = "$VER" ]; then
      echo "Version is already correct (npm version command failed but that's expected)"
    else
      echo "Failed to update version"
      exit 1
    fi
  }
fi
