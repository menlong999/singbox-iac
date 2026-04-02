import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

const fixturePath = path.resolve(process.cwd(), "tests/fixtures/subscriptions/trojan-sample.b64");

describe("author command", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("writes rules from a prompt, builds config, and installs a no-load launch agent", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-author-"));
    tempDirs.push(dir);

    const configPath = path.join(dir, "builder.config.yaml");
    const rulesPath = path.join(dir, "custom.rules.yaml");
    const launchAgentsDir = path.join(dir, "LaunchAgents");
    const logsDir = path.join(dir, "logs");

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
    includes: ["HK", "US", "JP"]
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
    - id: "openrouter-hk"
      name: "OpenRouter uses AI path"
      url: "https://openrouter.ai/favicon.ico"
      inbound: "in-mixed"
      expectedOutbound: "AI-Out"
schedule:
  enabled: false
  intervalMinutes: 30
`,
    );

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "author",
      "--config",
      configPath,
      "--prompt",
      "OpenRouter 和 Perplexity 走香港，YouTube Netflix 走美国，每45分钟自动更新",
      "--subscription-file",
      fixturePath,
      "--install-schedule",
      "--launch-agents-dir",
      launchAgentsDir,
      "--logs-dir",
      logsDir,
      "--label",
      "org.singbox-iac.author-test",
      "--no-load",
    ]);

    const rules = readFileSync(rulesPath, "utf8");
    const config = readFileSync(configPath, "utf8");
    const staging = readFileSync(path.join(dir, "staging.json"), "utf8");
    const plist = readFileSync(
      path.join(launchAgentsDir, "org.singbox-iac.author-test.plist"),
      "utf8",
    );

    expect(rules).toContain("openrouter.ai");
    expect(rules).toContain("netflix.com");
    expect(config).toContain("intervalMinutes: 45");
    expect(staging).toContain('"openrouter.ai"');
    expect(plist).toContain("update");
    expect(writeSpy).toHaveBeenCalled();
  });

  it("prints a diff preview without writing files", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-author-preview-"));
    tempDirs.push(dir);

    const configPath = path.join(dir, "builder.config.yaml");
    const rulesPath = path.join(dir, "custom.rules.yaml");
    const stagingPath = path.join(dir, "staging.json");

    const initialRules = "version: 1\nbeforeBuiltins: []\nafterBuiltins: []\n";
    writeFileSync(rulesPath, initialRules);
    writeFileSync(
      configPath,
      `version: 1
subscription:
  url: "https://example.com/subscription"
  format: "base64-lines"
  protocols:
    - trojan
output:
  stagingPath: "${stagingPath}"
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
    includes: ["HK", "US", "JP"]
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
    - id: "openrouter-hk"
      name: "OpenRouter uses AI path"
      url: "https://openrouter.ai/favicon.ico"
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

    const originalConfig = readFileSync(configPath, "utf8");
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "author",
      "--config",
      configPath,
      "--prompt",
      "OpenRouter 走香港，每45分钟自动更新",
      "--subscription-file",
      fixturePath,
      "--diff",
    ]);

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("Diff mode: no files were written.");
    expect(output).toContain("Intent IR diff:");
    expect(output).toContain("Rules diff:");
    expect(output).toContain("Builder config diff:");
    expect(output).toContain("Staging config diff:");
    expect(readFileSync(configPath, "utf8")).toBe(originalConfig);
    expect(readFileSync(rulesPath, "utf8")).toBe(initialRules);
    expect(existsSync(stagingPath)).toBe(false);
  });

  it("can emit Intent IR without writing files", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-author-intent-"));
    tempDirs.push(dir);

    const configPath = path.join(dir, "builder.config.yaml");
    const rulesPath = path.join(dir, "custom.rules.yaml");
    const stagingPath = path.join(dir, "staging.json");

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
  stagingPath: "${stagingPath}"
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
    includes: ["HK", "US", "JP"]
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
    - id: "openrouter-hk"
      name: "OpenRouter uses AI path"
      url: "https://openrouter.ai/favicon.ico"
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

    const originalConfig = readFileSync(configPath, "utf8");
    const originalRules = readFileSync(rulesPath, "utf8");
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "author",
      "--config",
      configPath,
      "--prompt",
      "OpenRouter 走香港",
      "--emit-intent-ir",
    ]);

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    const parsed = JSON.parse(output) as {
      sitePolicies: Array<{
        action?: { outboundGroup?: string };
        match?: { domainSuffix?: string[] };
      }>;
    };
    expect(
      parsed.sitePolicies.some(
        (policy) =>
          policy.action?.outboundGroup === "HK" &&
          (policy.match?.domainSuffix ?? []).includes("openrouter.ai"),
      ),
    ).toBe(true);
    expect(readFileSync(configPath, "utf8")).toBe(originalConfig);
    expect(readFileSync(rulesPath, "utf8")).toBe(originalRules);
    expect(existsSync(stagingPath)).toBe(false);
  });

  it("can run build and publish directly from author with --update", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-author-update-"));
    tempDirs.push(dir);

    const binaryPath = path.join(dir, "fake-sing-box");
    const configPath = path.join(dir, "builder.config.yaml");
    const rulesPath = path.join(dir, "custom.rules.yaml");
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
    writeFileSync(livePath, '{"old":"config"}\n');
    writeFileSync(
      configPath,
      `version: 1
subscription:
  url: "https://example.com/subscription"
  format: "base64-lines"
  protocols:
    - trojan
output:
  stagingPath: "${stagingPath}"
  livePath: "${livePath}"
  backupPath: "${backupPath}"
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
    includes: ["HK", "SG", "US"]
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
      "author",
      "--config",
      configPath,
      "--prompt",
      "OpenRouter 走香港，每30分钟自动更新",
      "--subscription-file",
      fixturePath,
      "--update",
      "--skip-verify",
      "--sing-box-bin",
      binaryPath,
    ]);

    expect(readFileSync(rulesPath, "utf8")).toContain("openrouter.ai");
    expect(readFileSync(livePath, "utf8")).toContain('"type": "trojan"');
    expect(readFileSync(backupPath, "utf8")).toContain('"old":"config"');
    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("Verified scenarios: skipped");
    expect(output).toContain(`Live: ${livePath}`);
  });
});
