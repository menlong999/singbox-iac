import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

const fixturePath = path.resolve(process.cwd(), "tests/fixtures/subscriptions/trojan-sample.b64");

describe("update command", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("builds and publishes a config when verification is explicitly skipped", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-update-"));
    tempDirs.push(dir);

    const binaryPath = path.join(dir, "fake-sing-box");
    const configPath = path.join(dir, "builder.config.yaml");
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
  dependencies:
    singBoxBinary: "${binaryPath}"
    singBoxSource: "explicit"
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
`,
    );

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "update",
      "--config",
      configPath,
      "--subscription-file",
      fixturePath,
      "--skip-verify",
    ]);

    expect(readFileSync(livePath, "utf8")).toContain('"type": "trojan"');
    expect(readFileSync(backupPath, "utf8")).toContain('"old":"config"');
    expect(writeSpy).toHaveBeenCalled();
    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("Runtime mode: headless-daemon");
    expect(output).toContain("Reload: skipped");
  });
});
