# Releasing `exiftool-vendored.pl`

The package's major.minor is the vendored ExifTool version: ExifTool 13.61
ships as `13.61.0`, and a package-only release after it as `13.61.1`. SemVer
drops ExifTool's zero-padded minor, so ExifTool 14.05 ships as `14.5.0`, and
the release workflow compares major and minor as numbers.

## Prepare the release notes

The release notes are the Unreleased section of `CHANGELOG.md`, and its
heading names the release's version.

- For an ExifTool update, `npm run update:exiftool` writes the line, for
  example `- 📦 Updated ExifTool to [13.61](https://exiftool.org/history.html#v13.61).`,
  and changes the heading to `## [Unreleased (13.61.0)]`. If the section
  already has an unreleased ExifTool update's line, the script replaces it; a
  run that finds no ExifTool newer than the last release leaves
  `CHANGELOG.md` alone. Commit `CHANGELOG.md` with `bin/`, `package.json`, and
  `package-lock.json`. Add a line of your own for any other change in the
  release.
- For a package-only release, rename `## [Unreleased]` to
  `## [Unreleased (13.61.1)]`, the next patch version, and write the notes
  under it by hand. `## [Unreleased (patch)]` does the same.

The update script refuses `## [Unreleased (minor)]` and
`## [Unreleased (major)]`. The release workflow refuses any version whose
major.minor is not the vendored ExifTool version, as with `(major)`, or
`(minor)` once that ExifTool's X.Y.0 is released, because the package version
follows ExifTool's. The release workflow also fails if the heading is missing,
names no version or bump, or has no notes under it.

## Release

1. Merge the ExifTool update or other release changes into `main` and wait for
   ordinary CI to pass.
2. Open **Build & Prepare Release** in GitHub Actions and run it from `main`.
   It sets the version the Unreleased heading names, renames that heading to
   `## [X.Y.Z] - YYYY-MM-DD` with a new empty `## [Unreleased]` above it, adds
   the version's `[X.Y.Z]: <url>` link definition, and pushes a signed release
   commit and annotated tag.
3. Wait for that workflow, then for the **Stage package on npm** job of the
   tag-bound **Stage npm Release** workflow. Leave that workflow running: its
   **Create immutable GitHub release** job waits for your npm approval.
4. Inspect the package under **Staged Packages** on npmjs.com, including its
   files, metadata, checksum evidence, and provenance.
5. Approve the stage with a maintainer's 2FA key.
6. Wait for the **Create immutable GitHub release** job to finish, then confirm
   that the GitHub release exists, is immutable, and has the version's
   `CHANGELOG.md` section at the top of its notes.

The **Create immutable GitHub release** job checks npm every 5 minutes, for up
to 5 hours 45 minutes, and creates the release once npm serves the approved
version. Its notes are the version's `CHANGELOG.md` section, followed by
GitHub's generated notes. GitHub emails the release to the repository's
watchers at that moment, so the email announces a version they can install.
[`photostructure/changelog-release-action`](https://github.com/photostructure/changelog-release-action)
does the `CHANGELOG.md` work and the npm wait.

## Recover from a failed release

- If the staged contents are wrong, reject the stage and release a new version.
  The rejected run's **Create immutable GitHub release** job then runs out of
  checks and fails without creating a release. Cancel that run, or ignore its
  failure, and do not re-run it.
- In that case, the release commit has already moved the notes under
  `## [X.Y.Z] - YYYY-MM-DD` in `CHANGELOG.md`, and the next release run fails
  until `## [Unreleased]` names a version and has notes. Rename that empty
  heading to `## [Unreleased (X.Y.Z+1)]`, the next patch version, move the
  unpublished version's notes under it,
  leave a line under `## [X.Y.Z]` saying that version was never published, and
  then start the new release.
- If the **Create immutable GitHub release** job fails before it creates the
  release (its checks ran out before you approved the stage, or `npm view`
  failed with an error other than E404), approve the stage if you have not,
  then use **Re-run failed jobs** on that **Stage npm Release** run. GitHub
  allows re-runs for 30 days. Do not start a new release.

Do not create or move a version tag manually, run `npm publish`, or approve a
stage whose package identity, contents, provenance, or tag commit is wrong.
