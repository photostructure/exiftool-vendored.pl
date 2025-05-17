#!/bin/bash -ex

# Updates to the latest version of exiftool. Assumes we can git clone exiftool
# into the parent directory.

if [ ! -d ../exiftool ]; then
  (
    cd ..
    git clone git@github.com:exiftool/exiftool.git
  )
fi

(
  cd ../exiftool
  git add .
  git stash -u
  git checkout master
  git pull
)

rm -rf bin
mkdir -p bin
cp -rp ../exiftool/* bin
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
