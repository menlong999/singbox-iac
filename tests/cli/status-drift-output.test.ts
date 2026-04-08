import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/modules/status/index.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/modules/status/index.js")>(
    "../../src/modules/status/index.js",
  );

  return {
    ...actual,
    collectStatusReport: vi.fn(),
  };
});

import { createProgram } from "../../src/cli/index.js";
import { type StatusReport, collectStatusReport } from "../../src/modules/status/index.js";

describe("status command drift output", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it("prints expected and actual system proxy endpoints when drift is detected", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-status-drift-"));
    tempDirs.push(dir);

    const configPath = path.join(dir, "builder.config.yaml");
    writeFileSync(configPath, createBuilderConfig(dir));

    vi.mocked(collectStatusReport).mockResolvedValue(createDriftReport(configPath));

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await createProgram().parseAsync(["node", "singbox-iac", "status", "--config", configPath]);

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("Summary:");
    expect(output).toContain("proxy: state=endpoint-mismatch, drift=true");
    expect(output).toContain("Runtime:");
    expect(output).toContain("system-proxy: state=endpoint-mismatch drift=true");
    expect(output).toContain("expected=127.0.0.1:39097");
    expect(output).toContain("actual=http=127.0.0.1:8888, socks=127.0.0.1:39097");
    expect(output).toContain("proxy-hint: Run `singbox-iac restart`");
    expect(output).toContain("watchdog: enabled=true");
    expect(output).toContain("interval=60s");
    expect(output).toContain("last-result=reasserted");
    expect(output).toContain("last-action=reassert-proxy");
    expect(output).toContain("last-trigger=proxy-drift");
    expect(output).toContain("watchdog-message: Reasserted the macOS system proxy");
  });
});

function createDriftReport(configPath: string): StatusReport {
  return {
    generatedAt: "2026-04-08T10:00:00.000Z",
    builderConfigPath: configPath,
    runtime: {
      singBoxBinary: "/opt/homebrew/bin/sing-box",
      binarySource: "explicit",
      processRunning: true,
      processIds: [12345],
      mode: "browser-proxy",
      desktopProfile: "system-proxy",
      runtimeLabel: "org.singbox-iac.runtime",
      launchAgentInstalled: true,
      launchAgentLoaded: true,
      systemProxyActive: false,
      systemProxy: {
        state: "endpoint-mismatch",
        drift: true,
        expected: {
          host: "127.0.0.1",
          port: 39097,
        },
        actual: [
          { kind: "http", enabled: true, host: "127.0.0.1", port: 8888 },
          { kind: "https", enabled: false },
          { kind: "socks", enabled: true, host: "127.0.0.1", port: 39097 },
        ],
        nextAction:
          "Run `singbox-iac restart` or disable the conflicting proxy app before retrying.",
      },
      watchdog: {
        enabled: true,
        intervalSeconds: 60,
        label: "org.singbox-iac.runtime.watchdog",
        launchAgentInstalled: true,
        launchAgentLoaded: true,
        statePath: path.join(path.dirname(configPath), "watchdog.json"),
        lastCheckedAt: "2026-04-08T10:00:00.000Z",
        lastResult: "reasserted",
        lastMessage: "Reasserted the macOS system proxy on 2 network service(s).",
        lastTrigger: "proxy-drift",
        lastRecoveryAction: "reassert-proxy",
        lastReassertAt: "2026-04-08T10:00:00.000Z",
      },
      listeners: [
        { tag: "in-mixed", listen: "127.0.0.1", port: 39097, active: true },
        { tag: "in-proxifier", listen: "127.0.0.1", port: 39091, active: true },
      ],
    },
    config: {
      stagingPath: path.join(path.dirname(configPath), "staging.json"),
      livePath: path.join(path.dirname(configPath), "live.json"),
      backupPath: path.join(path.dirname(configPath), "backup.json"),
      liveExists: true,
    },
    scheduler: {
      enabled: false,
      label: "org.singbox-iac.update",
      installed: false,
      plistPath: path.join(path.dirname(configPath), "org.singbox-iac.update.plist"),
    },
    history: {},
    diagnostics: [
      {
        level: "warn",
        message:
          "Desktop runtime is running in system-proxy mode, but macOS proxy state is http=127.0.0.1:8888, socks=127.0.0.1:39097 instead of 127.0.0.1:39097.",
      },
    ],
  };
}

function createBuilderConfig(dir: string): string {
  return `version: 1
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
`;
}
