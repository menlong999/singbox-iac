import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

describe("status command", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("prints a human-readable summary from builder config, launch agent, and history", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-status-"));
    tempDirs.push(dir);

    const fakeSingBox = path.join(dir, "fake-sing-box");
    const configPath = path.join(dir, "builder.config.yaml");
    const launchAgentsDir = path.join(dir, "LaunchAgents");
    const generatedDir = path.join(dir, "generated");
    const livePath = path.join(generatedDir, "live.json");
    const historyPath = path.join(generatedDir, "transactions.json");
    const label = "org.singbox-iac.test";

    writeExecutable(fakeSingBox);
    mkdirSync(generatedDir, { recursive: true });
    mkdirSync(launchAgentsDir, { recursive: true });
    writeFileSync(livePath, '{"ok":true}\n');
    writeFileSync(
      historyPath,
      `${JSON.stringify(
        {
          version: 1,
          entries: [
            {
              txId: "tx-123",
              generatedPath: path.join(generatedDir, "config.staging.json"),
              livePath,
              backupPath: path.join(generatedDir, "backup.json"),
              startedAt: "2026-04-02T10:00:00.000Z",
              status: "applied",
              verificationSummary: {},
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(path.join(launchAgentsDir, `${label}.plist`), "<plist></plist>\n");

    writeFileSync(
      configPath,
      `version: 1
subscription:
  url: "https://example.com/subscription"
  format: "base64-lines"
  protocols:
    - trojan
output:
  stagingPath: "${path.join(generatedDir, "config.staging.json")}"
  livePath: "${livePath}"
  backupPath: "${path.join(generatedDir, "backup.json")}"
runtime:
  checkCommand: "sing-box check -c {{stagingPath}}"
  reload:
    kind: "signal"
    processName: "sing-box"
    signal: "HUP"
  dependencies:
    singBoxBinary: "${fakeSingBox}"
    singBoxSource: "explicit"
  desktop:
    profile: "system-proxy"
    launchAgentLabel: "org.singbox-iac.runtime"
    tun:
      autoRoute: true
      strictRoute: false
      addresses:
        - "172.19.0.1/30"
        - "fdfe:dcba:9876::1/126"
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
  intervalMinutes: 30
authoring:
  provider: "deterministic"
  timeoutMs: 4000
`,
    );

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "status",
      "--config",
      configPath,
      "--launch-agents-dir",
      launchAgentsDir,
      "--label",
      label,
    ]);

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("Binary:");
    expect(output).toContain(fakeSingBox);
    expect(output).toContain("Desktop runtime:");
    expect(output).toContain("Live config:");
    expect(output).toContain(livePath);
    expect(output).toContain("Schedule:");
    expect(output).toContain(label);
    expect(output).toContain("Transactions:");
    expect(output).toContain("tx-123");
  });

  it("prints machine-readable JSON output", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-status-"));
    tempDirs.push(dir);

    const fakeSingBox = path.join(dir, "fake-sing-box");
    const configPath = path.join(dir, "builder.config.yaml");
    writeExecutable(fakeSingBox);
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
  dependencies:
    singBoxBinary: "${fakeSingBox}"
    singBoxSource: "explicit"
  desktop:
    profile: "system-proxy"
    launchAgentLabel: "org.singbox-iac.runtime"
    tun:
      autoRoute: true
      strictRoute: false
      addresses:
        - "172.19.0.1/30"
        - "fdfe:dcba:9876::1/126"
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
  enabled: false
  intervalMinutes: 30
authoring:
  provider: "deterministic"
  timeoutMs: 4000
`,
    );

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "status",
      "--config",
      configPath,
      "--json",
    ]);

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed.builderConfigPath).toBe(configPath);
    expect((parsed.runtime as Record<string, unknown>).singBoxBinary).toBe(fakeSingBox);
    expect((parsed.scheduler as Record<string, unknown>).enabled).toBe(false);
  });
});

function writeExecutable(filePath: string): void {
  writeFileSync(filePath, "#!/bin/sh\nexit 0\n");
  chmodSync(filePath, 0o755);
}
