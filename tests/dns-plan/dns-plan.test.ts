import { describe, expect, it } from "vitest";

import type { BuilderConfig } from "../../src/config/schema.js";
import { buildDnsPlan, compileDnsPlan } from "../../src/modules/dns-plan/index.js";
import { intentFromUserRules } from "../../src/modules/intent/index.js";

describe("dns plan", () => {
  it("builds an explicit DNS plan from config and intent", () => {
    const config = makeConfig();
    const intent = intentFromUserRules({
      beforeBuiltins: [
        {
          domainSuffix: ["openrouter.ai"],
          route: "AI-Out",
        },
      ],
      afterBuiltins: [
        {
          domainSuffix: ["intranet.example.cn"],
          route: "direct",
        },
      ],
      warnings: [],
    });

    const plan = buildDnsPlan({
      config,
      intent,
      activeRuleSetTags: ["geosite-cn", "geoip-cn", "geosite-google"],
    });
    const compiled = compileDnsPlan(plan);

    expect(plan.mode).toBe("real-ip");
    expect(plan.defaultResolvers).toEqual(["dns-local-default"]);
    expect(plan.nameserverPolicy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          match: {
            domainSuffix: ["openrouter.ai"],
          },
          resolvers: ["dns-remote-primary"],
        }),
        expect.objectContaining({
          match: {
            domainSuffix: ["intranet.example.cn"],
          },
          resolvers: ["dns-remote-cn"],
        }),
      ]),
    );
    expect(compiled).toMatchObject({
      final: "dns-local-default",
      strategy: "prefer_ipv4",
    });
  });
});

function makeConfig(): BuilderConfig {
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
    },
    listeners: {
      mixed: { enabled: true, listen: "127.0.0.1", port: 39097 },
      proxifier: { enabled: true, listen: "127.0.0.1", port: 39091 },
    },
    ruleSets: [],
    groups: {
      processProxy: { type: "selector", includes: ["US"], defaultTarget: "US" },
      aiOut: { type: "selector", includes: ["HK", "US"], defaultTarget: "HK" },
      devCommonOut: { type: "selector", includes: ["HK", "US"], defaultTarget: "HK" },
      stitchOut: { type: "selector", includes: ["US"], defaultTarget: "US" },
      global: { type: "urltest", includes: ["HK", "US"] },
    },
    rules: {
      userRulesFile: "/tmp/custom.rules.yaml",
    },
    verification: {
      scenarios: [
        {
          id: "chatgpt",
          name: "ChatGPT",
          url: "https://chatgpt.com/favicon.ico",
          inbound: "in-mixed",
          expectedOutbound: "AI-Out",
        },
      ],
    },
    schedule: {
      enabled: false,
      intervalMinutes: 30,
    },
    authoring: {
      provider: "deterministic",
      timeoutMs: 4000,
    },
  };
}
