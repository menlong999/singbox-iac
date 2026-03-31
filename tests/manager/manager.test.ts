import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applyConfig, checkConfig, runConfig } from "../../src/modules/manager/index.js";

describe("manager", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("checks, publishes, and runs configs via an explicit binary", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-manager-"));
    tempDirs.push(dir);

    const binaryPath = path.join(dir, "fake-sing-box");
    const stagingPath = path.join(dir, "staging.json");
    const livePath = path.join(dir, "live.json");
    const backupPath = path.join(dir, "backup.json");
    const runLogPath = path.join(dir, "run.log");

    writeFileSync(
      binaryPath,
      `#!/bin/sh
if [ "$1" = "check" ]; then
  exit 0
fi
if [ "$1" = "run" ]; then
  echo "ran $@" >> "${runLogPath}"
  exit 0
fi
exit 1
`,
    );
    chmodSync(binaryPath, 0o755);

    writeFileSync(stagingPath, '{"hello":"world"}\n');
    writeFileSync(livePath, '{"old":"config"}\n');

    await checkConfig({
      configPath: stagingPath,
      singBoxBinary: binaryPath,
    });

    await applyConfig({
      stagingPath,
      livePath,
      backupPath,
      singBoxBinary: binaryPath,
      reload: false,
    });

    expect(readFileSync(livePath, "utf8")).toContain('"hello":"world"');
    expect(readFileSync(backupPath, "utf8")).toContain('"old":"config"');

    const exitCode = await runConfig({
      configPath: livePath,
      singBoxBinary: binaryPath,
    });

    expect(exitCode).toBe(0);
    expect(readFileSync(runLogPath, "utf8")).toContain("run -c");
  });
});
