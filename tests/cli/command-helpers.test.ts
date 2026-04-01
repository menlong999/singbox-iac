import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { findDefaultConfigPath } from "../../src/cli/command-helpers.js";

describe("command helpers", () => {
  const tempDirs: string[] = [];
  const originalCwd = process.cwd();
  const originalHome = process.env.HOME;

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    process.chdir(originalCwd);
    if (originalHome === undefined) {
      process.env.HOME = undefined;
    } else {
      process.env.HOME = originalHome;
    }
  });

  it("prefers the user config directory over cwd-local config files", async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), "singbox-iac-home-"));
    const cwdDir = mkdtempSync(path.join(tmpdir(), "singbox-iac-cwd-"));
    tempDirs.push(homeDir, cwdDir);

    process.env.HOME = homeDir;
    process.chdir(cwdDir);

    const homeConfig = path.join(homeDir, ".config", "singbox-iac", "builder.config.yaml");
    const cwdConfig = path.join(cwdDir, "builder.config.local.yaml");

    mkdirSync(path.dirname(homeConfig), { recursive: true });
    writeFileSync(homeConfig, "version: 1\n");
    writeFileSync(cwdConfig, "version: 1\n");

    await expect(findDefaultConfigPath()).resolves.toBe(homeConfig);
  });
});
