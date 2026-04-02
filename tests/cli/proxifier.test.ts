import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

describe("proxifier command", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("lists supported bundles", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync(["node", "singbox-iac", "proxifier", "bundles"]);

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("antigravity: Antigravity");
    expect(output).toContain("developer-ai-cli: Developer AI CLI");
    expect(output).toContain("copilot-cli: Copilot CLI");
  });

  it("shows and renders a declarative bundle spec", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-proxifier-bundle-"));
    tempDirs.push(dir);

    const outputPath = path.join(dir, "antigravity.yaml");
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "proxifier",
      "bundles",
      "show",
      "antigravity",
    ]);
    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "proxifier",
      "bundles",
      "render",
      "antigravity",
      "--out",
      outputPath,
    ]);

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("ID: antigravity");
    expect(output).toContain("Outbound: Process-Proxy");
    expect(existsSync(outputPath)).toBe(true);
    expect(readFileSync(outputPath, "utf8")).toContain("targetOutboundGroup: Process-Proxy");
  });

  it("generates a scaffold from config and prompt-derived bundles", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-proxifier-"));
    tempDirs.push(dir);

    const configPath = path.join(dir, "builder.config.yaml");
    const outputDir = path.join(dir, "proxifier");

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
      "proxifier",
      "scaffold",
      "--config",
      configPath,
      "--out-dir",
      outputDir,
      "--prompt",
      "进程级走美国，Cursor 也走独立入口",
    ]);

    const guidePath = path.join(outputDir, "README.md");
    const antigravityBundlePath = path.join(outputDir, "bundles", "antigravity.txt");
    const cursorBundlePath = path.join(outputDir, "bundles", "cursor.txt");
    const antigravitySpecPath = path.join(outputDir, "bundle-specs", "antigravity.yaml");
    const combinedPath = path.join(outputDir, "all-processes.txt");
    const endpointPath = path.join(outputDir, "proxy-endpoint.txt");
    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");

    expect(existsSync(guidePath)).toBe(true);
    expect(existsSync(antigravityBundlePath)).toBe(true);
    expect(existsSync(cursorBundlePath)).toBe(true);
    expect(existsSync(antigravitySpecPath)).toBe(true);
    expect(existsSync(combinedPath)).toBe(true);
    expect(readFileSync(guidePath, "utf8")).toContain("SOCKS5");
    expect(readFileSync(antigravityBundlePath, "utf8")).toContain("language_server_macos_arm");
    expect(readFileSync(antigravitySpecPath, "utf8")).toContain(
      "targetOutboundGroup: Process-Proxy",
    );
    expect(readFileSync(cursorBundlePath, "utf8")).toContain("Cursor Helper");
    expect(readFileSync(endpointPath, "utf8")).toContain("39091");
    expect(output).toContain(`Output: ${outputDir}`);
    expect(output).toContain("Bundles: antigravity, cursor, developer-ai-cli");
    expect(output).toContain("Bundle specs:");
  });
});
