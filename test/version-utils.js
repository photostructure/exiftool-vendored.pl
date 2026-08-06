const assert = require("node:assert/strict");
const {
  getCurrentVersion,
  getLatestExifToolVersion,
  normalizeExifToolVersion,
} = require("../lib/version-utils");
const manifest = require("../vendor-manifest.json");

describe("ExifTool version checks", () => {
  it("compares the vendored artifact instead of the package patch version", () => {
    assert.strictEqual(normalizeExifToolVersion("13.59.1"), "13.59.0");
    assert.strictEqual(getCurrentVersion(), `${manifest.version}.0`);
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
