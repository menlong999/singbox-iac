import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

describe("schedule command", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("writes and removes a launch agent plist without touching the real user domain", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-schedule-"));
    tempDirs.push(dir);

    const configPath = path.join(dir, "builder.config.yaml");
    const launchAgentsDir = path.join(dir, "LaunchAgents");
    const logsDir = path.join(dir, "logs");
    const label = "org.singbox-iac.test";

    writeFileSync(
      configPath,
      `version: 1
subscription:
  url: "https://example.com/subscription"
  format: "base64-lines"
  protocols:
    - trojan
output:
  stagingPath: "${path.join(dir, "staging.json")}"
  livePath: "${path.join(dir, "live.json")}"
  backupPath: "${path.join(dir, "backup.json")}"
runtime:
  checkCommand: "sing-box check -c {{stagingPath}}"
  reload:
    kind: "signal"
    processName: "sing-box"
    signal: "HUP"
listeners:
  mixed:
    enabled: true
    listen: "127.0.0.1"
    port: 39097
  proxifier:
    enabled: true
    listen: "127.0.0.1"
    port: 39091
ruleSets: []
groups:
  processProxy:
    type: "selector"
    includes: ["US"]
  aiOut:
    type: "selector"
    includes: ["HK", "US"]
    defaultTarget: "HK"
  devCommonOut:
    type: "selector"
    includes: ["HK", "US"]
    defaultTarget: "HK"
  stitchOut:
    type: "selector"
    includes: ["US"]
    defaultTarget: "US"
  global:
    type: "urltest"
    includes: ["HK", "US"]
rules:
  userRulesFile: "${path.join(dir, "custom.rules.yaml")}"
verification:
  scenarios:
    - id: "chatgpt-hk"
      name: "ChatGPT uses the HK default AI path"
      url: "https://chatgpt.com/favicon.ico"
      inbound: "in-mixed"
      expectedOutbound: "AI-Out"
schedule:
  enabled: true
  intervalMinutes: 45
`,
    );

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "schedule",
      "install",
      "--config",
      configPath,
      "--label",
      label,
      "--launch-agents-dir",
      launchAgentsDir,
      "--logs-dir",
      logsDir,
      "--sing-box-bin",
      "/tmp/sing-box",
      "--chrome-bin",
      "/tmp/google-chrome",
      "--no-load",
    ]);

    const plistPath = path.join(launchAgentsDir, `${label}.plist`);
    const plist = readFileSync(plistPath, "utf8");
    expect(plist).toContain("<key>Label</key>");
    expect(plist).toContain(label);
    expect(plist).toContain("update");
    expect(plist).toContain(configPath);
    expect(plist).toContain("/node_modules/.bin/tsx");
    expect(plist).toContain("/src/cli/index.ts");
    expect(plist).toContain("<key>SING_BOX_BIN</key>");
    expect(plist).toContain("/tmp/sing-box");
    expect(plist).toContain("<key>CHROME_BIN</key>");
    expect(plist).toContain("/tmp/google-chrome");

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "schedule",
      "remove",
      "--label",
      label,
      "--launch-agents-dir",
      launchAgentsDir,
      "--no-unload",
    ]);

    expect(() => readFileSync(plistPath, "utf8")).toThrow();
    expect(writeSpy).toHaveBeenCalled();
  });
});
