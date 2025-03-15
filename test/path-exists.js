const fs = require("node:fs");
const assert = require("node:assert");

describe("exported path", () => {
  const exportedPath = require("..");

  it("is a valid path to a file", () => {
    assert(fs.existsSync(exportedPath));
  });

  if (process.platform !== "win32") {
    it("is executable", () => {
      const stats = fs.statSync(exportedPath);

      // Check if file has executable bit set for user
      const isExecutable = !!(stats.mode & fs.constants.S_IXUSR);
      console.dir({ exportedPath, mode: stats.mode.toString(8), isExecutable });

      assert(isExecutable);
    });
  }
});
