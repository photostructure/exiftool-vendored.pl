#!/bin/sh -ex

# Updates to the latest version of exiftool. Assumes we can git clone exiftool
# into the parent directory.

if [ ! -d ../exiftool ] ; then
  (cd .. ; git clone git@github.com:exiftool/exiftool.git)
fi

(cd ../exiftool ; git add . ; git stash ; git checkout master ; git pull)

rm -rf bin
mkdir -p bin
cp -rp ../exiftool/* bin
rm -rf bin/t bin/html bin/windows_exiftool

# exiftool never has a patch version:
NEWVER=$(bin/exiftool -ver).0-pre

yarn version --new-version $NEWVER
