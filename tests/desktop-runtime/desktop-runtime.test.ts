import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  installDesktopRuntimeAgent,
  removeDesktopRuntimeAgent,
  renderRuntimeLaunchAgentPlist,
  updateBuilderDesktopRuntime,
} from "../../src/modules/desktop-runtime/index.js";

describe("desktop runtime", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders a dedicated runtime LaunchAgent plist for sing-box run", () => {
    const plist = renderRuntimeLaunchAgentPlist({
      label: "org.singbox-iac.runtime-test",
      workingDirectory: "/tmp/workdir",
      stdoutPath: "/tmp/runtime.stdout.log",
      stderrPath: "/tmp/runtime.stderr.log",
      singBoxBinary: "/opt/homebrew/bin/sing-box",
      liveConfigPath: "/Users/test/.config/sing-box/config.json",
    });

    expect(plist).toContain("<key>KeepAlive</key>");
    expect(plist).toContain("/opt/homebrew/bin/sing-box");
    expect(plist).toContain("<string>run</string>");
    expect(plist).toContain("/Users/test/.config/sing-box/config.json");
  });

  it("writes and removes a runtime LaunchAgent without touching the real user domain", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-runtime-agent-"));
    tempDirs.push(dir);

    const launchAgentsDir = path.join(dir, "LaunchAgents");
    const logsDir = path.join(dir, "logs");
    const result = await installDesktopRuntimeAgent({
      liveConfigPath: path.join(dir, "live.json"),
      singBoxBinary: "/opt/homebrew/bin/sing-box",
      label: "org.singbox-iac.runtime-test",
      launchAgentsDir,
      logsDir,
      force: true,
      load: false,
    });

    const plist = readFileSync(result.plistPath, "utf8");
    expect(plist).toContain("org.singbox-iac.runtime-test");
    expect(plist).toContain("/opt/homebrew/bin/sing-box");

    const removed = await removeDesktopRuntimeAgent({
      label: result.label,
      launchAgentsDir,
      unload: false,
    });
    expect(removed).toBe(result.plistPath);
  });

  it("persists desktop runtime profile changes into the builder config", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-desktop-config-"));
    tempDirs.push(dir);

    const configPath = path.join(dir, "builder.config.yaml");
    writeFileSync(
      configPath,
      `version: 1
subscription:
  url: "https://example.com/subscription"
  format: "base64-lines"
  protocols:
    - trojan
output:
  stagingPath: "/tmp/staging.json"
  livePath: "/tmp/live.json"
  backupPath: "/tmp/backup.json"
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
  userRulesFile: "/tmp/custom.rules.yaml"
verification:
  scenarios: []
schedule:
  enabled: false
  intervalMinutes: 30
authoring:
  provider: "deterministic"
  timeoutMs: 4000
`,
    );

    await updateBuilderDesktopRuntime({
      configPath,
      profile: "tun",
    });

    const rendered = readFileSync(configPath, "utf8");
    expect(rendered).toContain("profile: tun");
    expect(rendered).toContain("launchAgentLabel: org.singbox-iac.runtime");
  });
});
