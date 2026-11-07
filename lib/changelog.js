// @ts-check

// The package's major.minor is the vendored ExifTool version, so an ExifTool
// update's release is X.YY.0. This writes that exact version into the
// Unreleased heading, which changelog-release-action passes to npm version. It
// finds the heading the way the action does (one heading matching
// /^#+ .*unreleased/i), and refuses one that names minor or major.
const BARE = "## [Unreleased]";
const HEADING_RE = /^## \[Unreleased(?: \((patch|\d+\.\d+\.\d+)\))?\]$/;

/**
 * Return CHANGELOG.md's text with an `## [Unreleased (X.YY.0)]` section that
 * links to ExifTool's notes for `exiftoolVersion`, such as "13.61". The heading
 * replaces `patch` or an earlier version, because a pending package-only
 * release or an earlier unreleased update ships as this ExifTool's X.YY.0. The
 * line replaces the line of an earlier unreleased ExifTool update, so the text
 * stays the same when it already names this version.
 *
 * @param {string} text
 * @param {string} exiftoolVersion
 */
function recordExifToolUpdate(text, exiftoolVersion) {
  // ExifTool 14.05 ships as 14.5.0: npm drops the leading zero, and the action
  // refuses a heading that keeps it.
  const [major, minor] = exiftoolVersion.split(".");
  const heading = `## [Unreleased (${major}.${Number(minor)}.0)]`;
  const lines = text.split("\n");
  const candidates = [];
  lines.forEach((line, i) => {
    if (/^#+ .*unreleased/i.test(line)) candidates.push(i);
  });
  if (candidates.length === 0) {
    throw new Error(
      `CHANGELOG.md has no "${BARE}" heading. Add "${BARE}" above the newest release, then run the update again.`,
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      `CHANGELOG.md has more than one Unreleased heading, on lines ${candidates.map((i) => i + 1).join(", ")}. Merge their notes under one "${BARE}" heading, then run the update again.`,
    );
  }
  const index = candidates[0];
  const current = lines[index];
  const bump = /^## \[Unreleased \((minor|major)\)\]$/.exec(current)?.[1];
  if (bump != null) {
    throw new Error(
      `Line ${index + 1} of CHANGELOG.md names a ${bump} release, but this package's version follows ExifTool's. Change it to "${heading}", then run the update again.`,
    );
  }
  if (!HEADING_RE.test(current)) {
    throw new Error(
      `Line ${index + 1} of CHANGELOG.md reads "${current}". Change it to "${BARE}" or "${heading}", then run the update again.`,
    );
  }

  let end = index + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  const bullet = `- 📦 Updated ExifTool to [${exiftoolVersion}](https://exiftool.org/history.html#v${exiftoolVersion}).`;
  const section = lines.slice(index + 1, end);
  const earlier = section.findIndex((line) =>
    /^- .*Updated ExifTool to /.test(line),
  );
  if (earlier === -1) {
    // Trim the section's blank lines so it reads heading, blank line, notes,
    // blank line, whatever the section looked like before.
    while (section.length > 0 && section[0].trim() === "") section.shift();
    while (section.length > 0 && section.at(-1)?.trim() === "") section.pop();
    section.unshift("", bullet);
    section.push("");
  } else {
    section[earlier] = bullet;
  }
  lines.splice(index, end - index, heading, ...section);
  return lines.join("\n");
}

module.exports = { recordExifToolUpdate };
