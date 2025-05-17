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

# Are there pending updates?
if [ "$(git status --porcelain=v1 2>/dev/null | wc -l)" -eq 0 ]; then
  echo "No-op: already up to date"
else
  # exiftool never has a patch version:
  VER=$(bin/exiftool -ver).0-pre
  npm version --no-git-tag-version "$VER"
fi
