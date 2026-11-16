const assert = require("node:assert/strict");
const {
  exiftoolReleaseVersion,
  getCurrentVersion,
  getLatestExifToolVersion,
  normalizeExifToolVersion,
} = require("../lib/version-utils");

describe("ExifTool version checks", () => {
  it("names a looked-up version the way ExifTool's release notes do", () => {
    // getLatestExifToolVersion returned "13.64.0" for ExifTool 13.64, whose
    // notes are at https://exiftool.org/history.html#v13.64.
    assert.strictEqual(exiftoolReleaseVersion("13.64.0"), "13.64");
    assert.throws(() => exiftoolReleaseVersion("13.64"), /13\.64/);
  });

  it("compares the vendored artifact instead of the package patch version", () => {
    assert.strictEqual(normalizeExifToolVersion("13.59.1"), "13.59.0");
    const current = getCurrentVersion();
    assert.match(current, /^\d+\.\d+\.0$/);
  });

  it("keeps retry and fallback diagnostics out of captured stdout", async () => {
    const stdout = [];
    const stderr = [];
    const originalLog = console.log;
    const originalError = console.error;
    console.log = (...args) => stdout.push(args);
    console.error = (...args) => stderr.push(args);

    try {
      const version = await getLatestExifToolVersion({
        fetchImpl: async (url) => {
          if (url.includes("api.github.com")) {
            throw new Error("simulated GitHub failure");
          }
          return {
            text: async () => `
              <rss><channel><item>
                <title>ExifTool 13.60 is now available</title>
              </item></channel></rss>
            `,
          };
        },
        retryDelayMs: 0,
        timeoutMs: 50,
      });

      assert.strictEqual(version, "13.60.0");
      assert.deepStrictEqual(stdout, []);
      assert(stderr.length > 0);
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  });
});
