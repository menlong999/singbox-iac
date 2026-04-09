import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { BuilderConfig } from "../../src/config/schema.js";
import {
  mergeNaturalLanguagePlans,
  resolveLayeredAuthoringPath,
  resolveLayeredAuthoringState,
} from "../../src/modules/layered-authoring/index.js";
import { generateRulesFromPrompt } from "../../src/modules/natural-language/index.js";

describe("layered authoring", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the latest patch ahead of earlier authored rules", () => {
    const merged = mergeNaturalLanguagePlans([
      generateRulesFromPrompt("OpenRouter 走香港，视频网站走美国"),
      generateRulesFromPrompt("Gemini 走新加坡，视频网站走新加坡"),
    ]);

    expect(merged.templateIds).toEqual(["video-sg"]);
    expect(
      merged.beforeBuiltins.some(
        (rule) => rule.domainSuffix?.includes("gemini.google.com") && rule.route === "SG",
      ),
    ).toBe(true);
    expect(
      merged.beforeBuiltins.some(
        (rule) => rule.domainSuffix?.includes("openrouter.ai") && rule.route === "HK",
      ),
    ).toBe(true);
    expect(
      merged.beforeBuiltins.some(
        (rule) => rule.domainSuffix?.includes("youtube.com") && rule.route === "SG",
      ),
    ).toBe(true);
    expect(
      merged.beforeBuiltins.some(
        (rule) => rule.domainSuffix?.includes("youtube.com") && rule.route === "US",
      ),
    ).toBe(false);
  });

  it("derives a legacy authored base plan from the current DSL and builder config", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-layered-authoring-"));
    tempDirs.push(dir);

    const rulesPath = path.join(dir, "custom.rules.yaml");
    writeFileSync(
      rulesPath,
      `version: 1
beforeBuiltins:
  - name: "OpenRouter uses HK"
    domainSuffix: ["openrouter.ai"]
    route: "HK"
afterBuiltins: []
`,
    );

    const config = makeConfig(rulesPath);
    const resolved = await resolveLayeredAuthoringState({ config });

    expect(resolved.exists).toBe(false);
    expect(resolved.filePath).toBe(resolveLayeredAuthoringPath(rulesPath));
    expect(resolved.mergedPlan.beforeBuiltins[0]).toMatchObject({
      domainSuffix: ["openrouter.ai"],
      route: "HK",
    });
    expect(resolved.mergedPlan.groupDefaults?.processProxy).toMatchObject({
      defaultTarget: "US",
      defaultNodePattern: "OnlyAI",
    });
    expect(resolved.mergedPlan.scheduleIntervalMinutes).toBe(45);
    expect(resolved.mergedIntent.processPolicies[0]).toMatchObject({
      inbound: "in-proxifier",
      outboundGroup: "US",
    });
    expect(resolved.mergedIntent.globals.updateIntervalMinutes).toBe(45);
  });
});

function makeConfig(rulesPath: string): BuilderConfig {
  return {
    version: 1,
    subscription: {
      url: "https://example.com/subscription",
      format: "base64-lines",
      protocols: ["trojan"],
    },
    output: {
      stagingPath: "/tmp/staging.json",
      livePath: "/tmp/live.json",
      backupPath: "/tmp/backup.json",
    },
    runtime: {
      checkCommand: "sing-box check -c {{stagingPath}}",
      reload: {
        kind: "signal",
        processName: "sing-box",
        signal: "HUP",
      },
      dependencies: {},
      desktop: {
        profile: "system-proxy",
        launchAgentLabel: "org.singbox-iac.runtime",
        tun: {
          autoRoute: true,
          strictRoute: false,
          addresses: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
        },
        watchdog: {
          enabled: true,
          intervalSeconds: 60,
          launchAgentLabel: "org.singbox-iac.runtime.watchdog",
        },
      },
    },
    listeners: {
      mixed: {
        enabled: true,
        listen: "127.0.0.1",
        port: 39097,
      },
      proxifier: {
        enabled: true,
        listen: "127.0.0.1",
        port: 39091,
      },
    },
    ruleSets: [],
    groups: {
      processProxy: {
        type: "selector",
        includes: ["US", "SG"],
        defaultTarget: "US",
        defaultNodePattern: "OnlyAI",
      },
      aiOut: {
        type: "selector",
        includes: ["HK", "US", "JP"],
        defaultTarget: "HK",
      },
      devCommonOut: {
        type: "selector",
        includes: ["HK", "US"],
        defaultTarget: "HK",
      },
      stitchOut: {
        type: "selector",
        includes: ["US"],
        defaultTarget: "US",
      },
      global: {
        type: "urltest",
        includes: ["HK", "US"],
      },
    },
    rules: {
      userRulesFile: rulesPath,
    },
    verification: {
      scenarios: [
        {
          id: "chatgpt-hk",
          name: "ChatGPT uses the HK default AI path",
          url: "https://chatgpt.com/favicon.ico",
          inbound: "in-mixed",
          expectedOutbound: "AI-Out",
        },
      ],
    },
    schedule: {
      enabled: true,
      intervalMinutes: 45,
    },
    authoring: {
      provider: "deterministic",
      timeoutMs: 4000,
    },
  };
}
