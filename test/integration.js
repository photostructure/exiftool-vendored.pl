const fs = require("node:fs");
const cp = require("node:child_process");
const assert = require("node:assert");
const manifest = require("../vendor-manifest.json");
const pkg = require("../package.json");
const { matchesVendorManifest } = require("../lib/vendor-manifest");
const { requiredPackageVersionRepair } = require("../lib/package-version");

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

describe("vendor manifest", () => {
  it("matches the package and records a verified source archive", () => {
    const [major, minor] = pkg.version.replace(/-pre$/, "").split(".");

    assert.strictEqual(manifest.version, `${major}.${minor}`);
    assert.strictEqual(manifest.platform, "non-win32");
    assert.strictEqual(manifest.architecture, "any");
    assert.strictEqual(
      manifest.filename,
      `Image-ExifTool-${manifest.version}.tar.gz`,
    );
    assert(manifest.sourceUrl.includes(manifest.filename));
    assert(Number.isSafeInteger(manifest.size) && manifest.size > 0);
    assert(/^[0-9a-f]{64}$/.test(manifest.sha256));
  });

  it("rejects a well-formed but incorrect checksum", () => {
    // Ground truth: https://exiftool.org/checksums.txt publishes the checksum
    // that update-exiftool.sh must match before treating an update as a no-op.
    const incorrect = { ...manifest, sha256: "0".repeat(64) };

    assert(matchesVendorManifest(manifest, { ...manifest }));
    assert(!matchesVendorManifest(incorrect, { ...manifest }));
  });

  it("repairs package metadata left stale by an interrupted update", () => {
    const currentLock = {
      version: pkg.version,
      packages: { "": { version: pkg.version } },
    };
    assert.strictEqual(
      requiredPackageVersionRepair(pkg.version, currentLock, manifest.version),
      null,
    );
    assert.strictEqual(
      requiredPackageVersionRepair("13.58.0", currentLock, manifest.version),
      `${manifest.version}.0-pre`,
    );
    assert.strictEqual(
      requiredPackageVersionRepair(
        pkg.version,
        { ...currentLock, version: "13.58.0" },
        manifest.version,
      ),
      pkg.version,
    );
  });
});
