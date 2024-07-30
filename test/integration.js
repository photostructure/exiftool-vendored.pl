const fs = require("node:fs");
const cp = require("node:child_process");
const assert = require("node:assert");

describe("spawned exiftool", () => {
  it("-ver", () => {
    const path = require("..");
    const child = cp.spawnSync(path, ["-ver"]);
    const ver = child.stdout.toString().trim();
    console.log({ version: ver });
    assert(
      /^\d\d\.\d\d$/.test(ver),
      "version is expected to be MAJOR.MINOR but was " + JSON.stringify(ver),
    );
    const stderr = child.stderr.toString();
    assert(
      stderr === "",
      "stderr is expected to be empty but was " + JSON.stringify(stderr),
    );
  });
});
