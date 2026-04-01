import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

describe("history command", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("prints recent transactions", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-history-"));
    tempDirs.push(dir);

    const configPath = path.join(dir, "builder.config.yaml");
    const historyPath = path.join(dir, "generated", "transactions.json");
    writeFileSync(configPath, baseConfigYaml(dir));
    mkdirSync(path.dirname(historyPath), { recursive: true });
    writeFileSync(
      historyPath,
      JSON.stringify(
        {
          version: 1,
          entries: [
            {
              txId: "tx-123",
              generatedPath: path.join(dir, "generated", "config.staging.json"),
              livePath: path.join(dir, "live", "config.json"),
              backupPath: path.join(dir, "generated", "config.last-known-good.json"),
              startedAt: "2026-04-02T00:00:00.000Z",
              status: "applied",
              verificationSummary: {},
            },
          ],
        },
        null,
        2,
      ),
    );

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await createProgram().parseAsync(["node", "singbox-iac", "history", "--config", configPath]);

    expect(writeSpy.mock.calls.map((call) => String(call[0])).join("")).toContain("tx-123");
  });
});

function baseConfigYaml(dir: string): string {
  return `version: 1
subscription:
  url: "https://example.com/subscription"
  format: "base64-lines"
  protocols:
    - trojan
output:
  stagingPath: "${path.join(dir, "generated", "config.staging.json")}"
  livePath: "${path.join(dir, "live", "config.json")}"
  backupPath: "${path.join(dir, "generated", "config.last-known-good.json")}"
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
      name: "ChatGPT uses the HK path"
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
