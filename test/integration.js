const fs = require("node:fs");
const cp = require("node:child_process");
const assert = require("node:assert");
const os = require("node:os");
const path = require("node:path");
const manifest = require("../vendor-manifest.json");
const pkg = require("../package.json");
const { matchesVendorManifest } = require("../lib/vendor-manifest");
const { requiredPackageVersionRepair } = require("../lib/package-version");
const { patchSetSha256 } = require("../lib/vendor-patch-set");

async function beforeTimeout(promise, timeoutMs, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnStayOpen(exiftoolPath, argFile, options = {}) {
  const child = cp.spawn(
    exiftoolPath,
    ["-stay_open", "True", "-@", argFile],
    options,
  );
  const output = { stdout: "", stderr: "" };
  child.stdout.on("data", (chunk) => {
    output.stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output.stderr += chunk.toString();
  });
  const closed = new Promise((resolve, reject) => {
    child.once("close", (code, signal) => resolve({ code, signal }));
    child.once("error", reject);
  });
  return { child, closed, output };
}

async function waitForStdout(session, expected) {
  await beforeTimeout(
    (async () => {
      while (!session.output.stdout.includes(expected)) {
        if (
          session.child.exitCode != null ||
          session.child.signalCode != null
        ) {
          throw new Error(
            `ExifTool exited before ${JSON.stringify(expected)}: ` +
              JSON.stringify(session.output),
          );
        }
        await delay(10);
      }
    })(),
    3_000,
    `ExifTool did not print ${JSON.stringify(expected)}`,
  );
}

async function cleanupStayOpen(session) {
  if (
    session != null &&
    session.child.exitCode == null &&
    session.child.signalCode == null
  ) {
    session.child.kill("SIGKILL");
    await beforeTimeout(
      session.closed,
      3_000,
      "ExifTool could not be cleaned up",
    );
  }
}

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

  it("exits when stay-open stdin reaches EOF", async function () {
    this.timeout(10_000);
    const path = require("..");
    const session = spawnStayOpen(path, "-");

    try {
      session.child.stdin.write("-ver\n-execute\n");
      await waitForStdout(session, "{ready}");
      session.child.stdin.end();
      const result = await beforeTimeout(
        session.closed,
        2_000,
        "ExifTool stayed alive after stdin EOF",
      );
      assert.deepStrictEqual(
        result,
        { code: 0, signal: null },
        session.output.stderr,
      );
    } finally {
      await cleanupStayOpen(session);
    }
  });

  it("exits when unnamed-pipe stdin reaches EOF", async function () {
    this.timeout(10_000);
    const exiftoolPath = require("..");
    const shell = cp.spawn(
      "sh",
      [
        "-c",
        'printf "%s\\n" -ver -execute | "$1" -stay_open True -@ -',
        "sh",
        exiftoolPath,
      ],
      { detached: true },
    );
    assert(shell.pid != null, "pipe fixture did not receive a PID");
    let stdout = "";
    let stderr = "";
    shell.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    shell.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    const closed = new Promise((resolve, reject) => {
      shell.once("close", (code, signal) => resolve({ code, signal }));
      shell.once("error", reject);
    });

    try {
      const result = await beforeTimeout(
        closed,
        2_000,
        "ExifTool stayed alive after unnamed-pipe EOF",
      );
      assert.deepStrictEqual(result, { code: 0, signal: null }, stderr);
      assert(stdout.includes("{ready}"), JSON.stringify({ stdout, stderr }));
    } finally {
      if (shell.exitCode == null && shell.signalCode == null) {
        process.kill(-shell.pid, "SIGKILL");
        await beforeTimeout(
          closed,
          3_000,
          "pipe fixture could not be cleaned up",
        );
      }
    }
  });

  it("still honors explicit stay-open shutdown", async function () {
    this.timeout(10_000);
    const exiftoolPath = require("..");
    const session = spawnStayOpen(exiftoolPath, "-");

    try {
      session.child.stdin.write("-ver\n-execute\n");
      await waitForStdout(session, "{ready}");
      session.child.stdin.write("-stay_open\nFalse\n");
      const result = await beforeTimeout(
        session.closed,
        2_000,
        "ExifTool ignored explicit stay-open shutdown",
      );
      assert.deepStrictEqual(
        result,
        { code: 0, signal: null },
        session.output.stderr,
      );
    } finally {
      await cleanupStayOpen(session);
    }
  });

  it("keeps polling regular-file stdin after EOF", async function () {
    this.timeout(10_000);
    const exiftoolPath = require("..");
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "exiftool-stdin-"));
    const stdinPath = path.join(tempDir, "args.txt");
    fs.writeFileSync(stdinPath, "-ver\n-execute1\n");
    const stdinFd = fs.openSync(stdinPath, "r");
    let session;

    try {
      try {
        session = spawnStayOpen(exiftoolPath, "-", {
          stdio: [stdinFd, "pipe", "pipe"],
        });
      } finally {
        fs.closeSync(stdinFd);
      }
      await waitForStdout(session, "{ready1}");

      const earlyExit = await Promise.race([
        session.closed,
        delay(200).then(() => null),
      ]);
      assert.strictEqual(
        earlyExit,
        null,
        "regular-file stdin must remain open for appended arguments",
      );

      fs.appendFileSync(stdinPath, "-ver\n-execute2\n");
      await waitForStdout(session, "{ready2}");
      fs.appendFileSync(stdinPath, "-stay_open\nFalse\n");
      const result = await beforeTimeout(
        session.closed,
        2_000,
        "ExifTool ignored explicit shutdown from regular-file stdin",
      );
      assert.deepStrictEqual(
        result,
        { code: 0, signal: null },
        session.output.stderr,
      );
    } finally {
      await cleanupStayOpen(session);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps polling a regular ARGFILE after EOF", async function () {
    this.timeout(10_000);
    const exiftoolPath = require("..");
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "exiftool-argfile-"));
    const argFile = path.join(tempDir, "args.txt");
    fs.writeFileSync(argFile, "-ver\n-execute1\n");
    let session;

    try {
      session = spawnStayOpen(exiftoolPath, argFile);
      await waitForStdout(session, "{ready1}");

      const earlyExit = await Promise.race([
        session.closed,
        delay(200).then(() => null),
      ]);
      assert.strictEqual(
        earlyExit,
        null,
        "a regular ARGFILE must remain open for appended arguments",
      );

      fs.appendFileSync(argFile, "-ver\n-execute2\n");
      await waitForStdout(session, "{ready2}");
      fs.appendFileSync(argFile, "-stay_open\nFalse\n");
      const result = await beforeTimeout(
        session.closed,
        2_000,
        "ExifTool ignored explicit shutdown from its ARGFILE",
      );
      assert.deepStrictEqual(
        result,
        { code: 0, signal: null },
        session.output.stderr,
      );
    } finally {
      await cleanupStayOpen(session);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
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
    assert.strictEqual(manifest.patchSetSha256, patchSetSha256);
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
