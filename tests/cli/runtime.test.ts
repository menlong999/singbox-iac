import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

describe("desktop runtime commands", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("writes, stops, and rewrites the dedicated runtime LaunchAgent", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-runtime-cli-"));
    tempDirs.push(dir);

    const configPath = path.join(dir, "builder.config.yaml");
    const launchAgentsDir = path.join(dir, "LaunchAgents");
    const logsDir = path.join(dir, "logs");
    const livePath = path.join(dir, "live.json");
    const fakeSingBox = path.join(dir, "fake-sing-box");
    const label = "org.singbox-iac.runtime-test";
    writeExecutable(fakeSingBox);
    writeFileSync(
      livePath,
      '{"log":{"level":"info"},"dns":{"servers":[{"type":"local","tag":"dns-local-default"}],"final":"dns-local-default","strategy":"prefer_ipv4"},"inbounds":[{"type":"mixed","tag":"in-mixed","listen":"127.0.0.1","listen_port":39097,"set_system_proxy":true},{"type":"mixed","tag":"in-proxifier","listen":"127.0.0.1","listen_port":39091}],"outbounds":[{"type":"direct","tag":"direct"},{"type":"selector","tag":"Global","outbounds":["direct"]}],"route":{"rules":[{"action":"sniff"}],"final":"Global","auto_detect_interface":true,"default_domain_resolver":"dns-local-default"}}\n',
    );

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
  livePath: "${livePath}"
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
    launchAgentLabel: "${label}"
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
      "start",
      "--config",
      configPath,
      "--launch-agents-dir",
      launchAgentsDir,
      "--logs-dir",
      logsDir,
      "--no-load",
      "--force",
    ]);

    const plistPath = path.join(launchAgentsDir, `${label}.plist`);
    expect(existsSync(plistPath)).toBe(true);
    expect(readFileSync(plistPath, "utf8")).toContain(livePath);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "stop",
      "--config",
      configPath,
      "--launch-agents-dir",
      launchAgentsDir,
      "--no-unload",
    ]);
    expect(existsSync(plistPath)).toBe(false);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "restart",
      "--config",
      configPath,
      "--launch-agents-dir",
      launchAgentsDir,
      "--logs-dir",
      logsDir,
      "--no-load",
    ]);
    expect(existsSync(plistPath)).toBe(true);
    expect(writeSpy).toHaveBeenCalled();
  });
});

function writeExecutable(filePath: string): void {
  writeFileSync(filePath, "#!/bin/sh\nexit 0\n");
  chmodSync(filePath, 0o755);
}
