import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

describe("apply command", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("validates and publishes a config with explicit paths", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-apply-"));
    tempDirs.push(dir);

    const binaryPath = path.join(dir, "fake-sing-box");
    const stagingPath = path.join(dir, "staging.json");
    const livePath = path.join(dir, "live.json");
    const backupPath = path.join(dir, "backup.json");

    writeFileSync(
      binaryPath,
      `#!/bin/sh
if [ "$1" = "check" ]; then
  exit 0
fi
exit 1
`,
    );
    chmodSync(binaryPath, 0o755);
    writeFileSync(stagingPath, '{"new":"config"}\n');
    writeFileSync(livePath, '{"old":"config"}\n');

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "apply",
      "--input",
      stagingPath,
      "--live-path",
      livePath,
      "--backup-path",
      backupPath,
      "--sing-box-bin",
      binaryPath,
    ]);

    expect(readFileSync(livePath, "utf8")).toContain('"new":"config"');
    expect(readFileSync(backupPath, "utf8")).toContain('"old":"config"');
    expect(writeSpy).toHaveBeenCalled();
  });
});
