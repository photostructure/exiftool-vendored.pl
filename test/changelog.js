const assert = require("node:assert/strict");
const { recordExifToolUpdate } = require("../lib/changelog");

const HEADER = "# Changelog\n\nIntro.\n\n";
const RELEASED = "## [13.60.0] - 2026-10-20\n\n- 📦 Older notes.\n";
const BULLET_13_61 =
  "- 📦 Updated ExifTool to [13.61](https://exiftool.org/history.html#v13.61).";

describe("recordExifToolUpdate()", () => {
  it("names the release version and adds the ExifTool line to a bare Unreleased heading", () => {
    assert.equal(
      recordExifToolUpdate(HEADER + "## [Unreleased]\n\n" + RELEASED, "13.61"),
      HEADER +
        "## [Unreleased (13.61.0)]\n\n" +
        BULLET_13_61 +
        "\n\n" +
        RELEASED,
    );
  });

  it("drops a zero-padded minor from the heading but keeps it in the line", () => {
    // changelog-release-action v0.3.0's bump refuses "14.05.0" ("an exact
    // version without leading zeros"); ExifTool names the release 14.05.
    assert.equal(
      recordExifToolUpdate(HEADER + "## [Unreleased]\n", "14.05"),
      HEADER +
        "## [Unreleased (14.5.0)]\n\n" +
        "- 📦 Updated ExifTool to [14.05](https://exiftool.org/history.html#v14.05).\n",
    );
  });

  it("adds the ExifTool line when Unreleased is the last heading", () => {
    assert.equal(
      recordExifToolUpdate(HEADER + "## [Unreleased]\n", "13.61"),
      HEADER + "## [Unreleased (13.61.0)]\n\n" + BULLET_13_61 + "\n",
    );
  });

  it("puts the ExifTool line above notes already under Unreleased (patch)", () => {
    assert.equal(
      recordExifToolUpdate(
        HEADER + "## [Unreleased (patch)]\n\n- 🐞 Fixed a bug.\n\n" + RELEASED,
        "13.61",
      ),
      HEADER +
        "## [Unreleased (13.61.0)]\n\n" +
        BULLET_13_61 +
        "\n- 🐞 Fixed a bug.\n\n" +
        RELEASED,
    );
  });

  it("folds a pending package-only release into the ExifTool update", () => {
    assert.equal(
      recordExifToolUpdate(
        HEADER +
          "## [Unreleased (13.60.1)]\n\n- 🐞 Fixed a bug.\n\n" +
          RELEASED,
        "13.61",
      ),
      HEADER +
        "## [Unreleased (13.61.0)]\n\n" +
        BULLET_13_61 +
        "\n- 🐞 Fixed a bug.\n\n" +
        RELEASED,
    );
  });

  it("replaces the line of an earlier ExifTool update that was never released", () => {
    assert.equal(
      recordExifToolUpdate(
        HEADER +
          "## [Unreleased (13.61.0)]\n\n- 🐞 Fixed a bug.\n" +
          BULLET_13_61 +
          "\n\n" +
          RELEASED,
        "13.62",
      ),
      HEADER +
        "## [Unreleased (13.62.0)]\n\n- 🐞 Fixed a bug.\n" +
        "- 📦 Updated ExifTool to [13.62](https://exiftool.org/history.html#v13.62).\n\n" +
        RELEASED,
    );
  });

  it("leaves the text unchanged when it already records this version", () => {
    const text =
      HEADER +
      "## [Unreleased (13.61.0)]\n\n" +
      BULLET_13_61 +
      "\n\n" +
      RELEASED;
    assert.equal(recordExifToolUpdate(text, "13.61"), text);
  });

  for (const bump of ["minor", "major"]) {
    it(`refuses an Unreleased (${bump}) heading`, () => {
      assert.throws(
        () =>
          recordExifToolUpdate(
            HEADER + `## [Unreleased (${bump})]\n\n- ✨ Feature.\n`,
            "13.61",
          ),
        {
          message: new RegExp(
            `Line 5 of CHANGELOG\\.md names a ${bump} release.*follows ExifTool's.*## \\[Unreleased \\(13\\.61\\.0\\)\\]`,
            "s",
          ),
        },
      );
    });
  }

  it("refuses a CHANGELOG.md with no Unreleased heading", () => {
    assert.throws(() => recordExifToolUpdate(HEADER + RELEASED, "13.61"), {
      message: /no "## \[Unreleased\]" heading.*Add "## \[Unreleased\]"/s,
    });
  });

  it("refuses a CHANGELOG.md with two Unreleased headings", () => {
    assert.throws(
      () =>
        recordExifToolUpdate(
          HEADER + "## [Unreleased]\n\n## [Unreleased (patch)]\n\n" + RELEASED,
          "13.61",
        ),
      { message: /more than one Unreleased heading.*lines 5, 7/s },
    );
  });

  it("refuses an Unreleased heading it cannot parse", () => {
    assert.throws(
      () => recordExifToolUpdate(HEADER + "## Unreleased\n", "13.61"),
      {
        message:
          /Line 5 of CHANGELOG\.md.*"## \[Unreleased\]" or "## \[Unreleased \(13\.61\.0\)\]"/s,
      },
    );
  });
});
