const fs = require("node:fs");
const assert = require("node:assert");

describe("exported path", () => {
  it("is a valid path to a file", () => {
    const path = require("..");
    assert(fs.existsSync(path));
  });
});
