import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

describe("rulesets command", () => {
  const tempDirs: string[] = [];
  const originalHome = process.env.HOME;

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    if (originalHome === undefined) {
      process.env.HOME = undefined;
    } else {
      process.env.HOME = originalHome;
    }
    vi.restoreAllMocks();
  });

  it("lists configured tags and filtered official upstream tags", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-rulesets-cli-"));
    tempDirs.push(dir);
    process.env.HOME = dir;

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
ruleSets:
  - tag: "geosite-openai"
    format: "binary"
    type: "local"
    path: "${path.join(dir, "geosite-openai.srs")}"
groups:
  processProxy:
    type: "selector"
    includes: ["US"]
  aiOut:
    type: "selector"
    includes: ["HK", "US"]
  devCommonOut:
    type: "selector"
    includes: ["HK", "US"]
  stitchOut:
    type: "selector"
    includes: ["US"]
  global:
    type: "urltest"
    includes: ["HK", "US"]
rules:
  userRulesFile: "${path.join(dir, "custom.rules.yaml")}"
verification:
  scenarios:
    - id: "chatgpt"
      name: "ChatGPT"
      url: "https://chatgpt.com/favicon.ico"
      inbound: "in-mixed"
      expectedOutbound: "AI-Out"
schedule:
  enabled: false
  intervalMinutes: 60
`,
      "utf8",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | RequestInfo) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : String(input);
        if (url.endsWith("/SagerNet/sing-geosite/git/ref/heads/rule-set")) {
          return jsonResponse({ object: { sha: "geosite-ref" } });
        }
        if (url.endsWith("/SagerNet/sing-geoip/git/ref/heads/rule-set")) {
          return jsonResponse({ object: { sha: "geoip-ref" } });
        }
        if (url.includes("/SagerNet/sing-geosite/git/trees/geosite-ref")) {
          return jsonResponse({
            tree: [{ path: "geosite-openai.srs" }, { path: "geosite-openrouter.srs" }],
          });
        }
        if (url.includes("/SagerNet/sing-geoip/git/trees/geoip-ref")) {
          return jsonResponse({ tree: [{ path: "geoip-cn.srs" }] });
        }
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "rulesets",
      "list",
      "--config",
      configPath,
      "--filter",
      "openai",
    ]);

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");

    expect(output).toContain(
      "Rule-set inventory: configured tags plus official upstream geosite/geoip catalog.",
    );
    expect(output).toContain("tags: geosite-openai");
    expect(output).toContain("geosite-tags: geosite-openai");
    expect(output).toContain("OpenAI");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
