import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/load-config.js";

describe("loadConfig", () => {
  it("accepts persisted runtime dependency sources written back to config", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "singbox-iac-config-"));
    const configPath = path.join(dir, "builder.config.yaml");

    await writeFile(
      configPath,
      `version: 1
subscription:
  url: https://example.com/subscription
  format: base64-lines
  protocols:
    - trojan
output:
  stagingPath: ${dir}/generated/config.staging.json
  livePath: ${dir}/generated/config.live.json
  backupPath: ${dir}/generated/config.backup.json
runtime:
  checkCommand: sing-box check -c
  reload:
    kind: signal
    processName: sing-box
    signal: HUP
  dependencies:
    singBoxBinary: /opt/homebrew/bin/sing-box
    singBoxSource: persisted
    chromeBinary: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
    chromeSource: persisted
    resolvedAt: 2026-04-02T08:00:00.000Z
  desktop:
    profile: system-proxy
    launchAgentLabel: org.singbox-iac.runtime
    tun:
      autoRoute: true
      strictRoute: false
      addresses:
        - 172.19.0.1/30
        - fdfe:dcba:9876::1/126
listeners:
  mixed:
    enabled: true
    listen: 127.0.0.1
    port: 39097
  proxifier:
    enabled: true
    listen: 127.0.0.1
    port: 39091
ruleSets:
  - tag: geosite-cn
    type: local
    format: binary
    path: ${dir}/rule-set/geosite-cn.srs
groups:
  processProxy:
    type: selector
    includes:
      - US
  aiOut:
    type: selector
    includes:
      - HK
  global:
    type: selector
    includes:
      - HK
  devCommonOut:
    type: selector
    includes:
      - HK
  stitchOut:
    type: selector
    includes:
      - US
rules:
  userRulesFile: ${dir}/rules/custom.rules.yaml
verification:
  scenarios:
    - id: smoke
      name: Smoke
      url: https://example.com
      inbound: in-mixed
      expectedOutbound: HK
schedule:
  enabled: false
  intervalMinutes: 30
authoring:
  provider: deterministic
  timeoutMs: 4000
`,
      "utf8",
    );

    const config = await loadConfig(configPath);

    expect(config.runtime.dependencies.singBoxSource).toBe("persisted");
    expect(config.runtime.dependencies.chromeSource).toBe("persisted");
  });
});
