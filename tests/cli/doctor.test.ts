import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

describe("doctor command", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("reports environment readiness using explicit binaries and config", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-doctor-"));
    tempDirs.push(dir);

    const fakeSingBox = path.join(dir, "fake-sing-box");
    const fakeChrome = path.join(dir, "fake-chrome");
    const rulesPath = path.join(dir, "custom.rules.yaml");
    const configPath = path.join(dir, "builder.config.yaml");
    const launchAgentsDir = path.join(dir, "LaunchAgents");

    writeExecutable(fakeSingBox);
    writeExecutable(fakeChrome);
    writeFileSync(rulesPath, "version: 1\nbeforeBuiltins: []\nafterBuiltins: []\n");
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
  userRulesFile: "${rulesPath}"
verification:
  scenarios:
    - id: "chatgpt-hk"
      name: "ChatGPT uses the HK default AI path"
      url: "https://chatgpt.com/favicon.ico"
      inbound: "in-mixed"
      expectedOutbound: "AI-Out"
schedule:
  enabled: true
  intervalMinutes: 30
`,
    );

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "doctor",
      "--config",
      configPath,
      "--sing-box-bin",
      fakeSingBox,
      "--chrome-bin",
      fakeChrome,
      "--launch-agents-dir",
      launchAgentsDir,
    ]);

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("[PASS] sing-box:");
    expect(output).toContain("[PASS] chrome:");
    expect(output).toContain("[PASS] builder-config:");
  });
});

function writeExecutable(filePath: string): void {
  writeFileSync(filePath, "#!/bin/sh\nexit 0\n");
  chmodSync(filePath, 0o755);
}
