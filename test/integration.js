const fs = require("node:fs");
const cp = require("node:child_process");
const assert = require("node:assert");
const os = require("node:os");
const path = require("node:path");
const pkg = require("../package.json");
const { requiredPackageVersionRepair } = require("../lib/package-version");

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

describe("ImageHashProgress (patches/2026-09-24-exiftool-imagehash-progress.patch)", () => {
  let tempDir;
  let jpeg;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "exiftool-progress-"));
    jpeg = path.join(tempDir, "scan.jpg");
    // SOI, a bare SOS header, 64 runs of 64 KiB scan data, then EOI. ExifTool
    // hashes JPEG scan data one 0xff-delimited run at a time, so stuffed 0xff00
    // bytes between the runs make each run a separate digest add. (Stuffing
    // right before EOI would add an empty run, which repeats the last count.)
    const scan = [];
    for (let i = 0; i < 64; i++) {
      if (i > 0) scan.push(Buffer.from([0xff, 0x00]));
      scan.push(Buffer.alloc(64 << 10, 0x5a));
    }
    fs.writeFileSync(
      jpeg,
      Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00]),
        Buffer.from([0x00, 0x3f, 0x00]),
        ...scan,
        Buffer.from([0xff, 0xd9]),
      ]),
    );
  });

  after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  function hashImageData(...apiArgs) {
    const child = cp.spawnSync(require(".."), [
      ...apiArgs.flatMap((ea) => ["-api", ea]),
      "-ImageDataHash",
      "-s3",
      jpeg,
    ]);
    assert.strictEqual(child.status, 0, child.stderr.toString());
    return {
      hash: child.stdout.toString().trim(),
      stderr: child.stderr.toString().split("\n").filter(Boolean),
    };
  }

  it("reports increasing bytes hashed on stderr", () => {
    const { hash, stderr } = hashImageData("ImageHashProgress=0.000001");
    // Hashing each 64 KiB run takes far longer than the 1 µs interval.
    assert(
      stderr.length >= 64,
      `expected a line per run, got ${stderr.length}`,
    );
    const bytes = stderr.map((line) => {
      const m = /^\{progress:(\d+)\}$/.exec(line);
      assert(m != null, "unexpected stderr line: " + JSON.stringify(line));
      return Number(m[1]);
    });
    for (let i = 1; i < bytes.length; i++) {
      assert(bytes[i] > bytes[i - 1], "not increasing: " + bytes.join(", "));
    }
    assert(bytes.at(-1) <= fs.statSync(jpeg).size);
    assert.strictEqual(hash, hashImageData().hash);
  });

  it("prints nothing unless requested", () => {
    const { hash, stderr } = hashImageData();
    assert.match(hash, /^[0-9a-f]{32}$/);
    assert.deepStrictEqual(stderr, []);
  });
});

describe("package version", () => {
  it("repairs package metadata left stale by an interrupted update", () => {
    const exiftoolVersion = cp
      .execFileSync(require(".."), ["-ver"], { encoding: "utf8" })
      .trim();
    const currentLock = {
      version: pkg.version,
      packages: { "": { version: pkg.version } },
    };
    assert.strictEqual(
      requiredPackageVersionRepair(pkg.version, currentLock, exiftoolVersion),
      null,
    );
    assert.strictEqual(
      requiredPackageVersionRepair("13.58.0", currentLock, exiftoolVersion),
      `${exiftoolVersion}.0-pre`,
    );
    assert.strictEqual(
      requiredPackageVersionRepair(
        pkg.version,
        { ...currentLock, version: "13.58.0" },
        exiftoolVersion,
      ),
      pkg.version,
    );
  });
});
