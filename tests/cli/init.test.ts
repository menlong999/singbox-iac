import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

describe("init command", () => {
  const tempDirs: string[] = [];
  const originalCwd = process.cwd();

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    process.chdir(originalCwd);
    vi.restoreAllMocks();
  });

  it("writes starter config assets and seeds the subscription URL", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-init-"));
    tempDirs.push(dir);

    const configOut = path.join(dir, "builder.config.local.yaml");
    const rulesOut = path.join(dir, "custom.rules.yaml");
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "init",
      "--config-out",
      configOut,
      "--rules-out",
      rulesOut,
      "--subscription-url",
      "https://example.com/my-real-subscription",
    ]);

    const generatedConfig = readFileSync(configOut, "utf8");
    expect(generatedConfig).toContain('url: "https://example.com/my-real-subscription"');
    expect(generatedConfig).toContain(`userRulesFile: "${rulesOut}"`);
    expect(generatedConfig).toContain('tag: "geosite-openai"');
    expect(readFileSync(rulesOut, "utf8")).toContain("beforeBuiltins:");
    expect(writeSpy).toHaveBeenCalled();
  });

  it("works from a cwd without a local examples directory", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-init-cwd-"));
    tempDirs.push(dir);
    process.chdir(dir);

    const configOut = path.join(dir, "builder.config.yaml");
    const rulesOut = path.join(dir, "custom.rules.yaml");

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "init",
      "--config-out",
      configOut,
      "--rules-out",
      rulesOut,
      "--subscription-url",
      "https://example.com/from-temp-cwd",
    ]);

    expect(readFileSync(configOut, "utf8")).toContain('url: "https://example.com/from-temp-cwd"');
    expect(readFileSync(rulesOut, "utf8")).toContain("version: 1");
  });
});
