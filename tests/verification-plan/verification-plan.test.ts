import { describe, expect, it } from "vitest";

import type { BuilderConfig } from "../../src/config/schema.js";
import { buildDnsPlan } from "../../src/modules/dns-plan/index.js";
import { intentFromNaturalLanguagePlan } from "../../src/modules/intent/index.js";
import { buildVerificationPlan } from "../../src/modules/verification-plan/index.js";

describe("verification plan", () => {
  it("derives route, dns, egress, app, and protocol checks from config and intent", () => {
    const config = makeConfig();
    const intent = intentFromNaturalLanguagePlan({
      beforeBuiltins: [
        {
          domainSuffix: ["gemini.google.com"],
          route: "SG",
        },
      ],
      afterBuiltins: [],
      templateIds: [],
      notes: [],
      scheduleIntervalMinutes: 45,
      groupDefaults: {
        processProxy: {
          defaultTarget: "US",
          defaultNodePattern: "OnlyAI",
        },
      },
      verificationOverrides: [],
    });

    const dnsPlan = buildDnsPlan({
      config,
      intent,
      activeRuleSetTags: ["geosite-cn", "geoip-cn"],
    });
    const plan = buildVerificationPlan({
      config,
      intent,
      dnsPlan,
    });

    expect(plan.routeChecks.length).toBe(2);
    expect(plan.dnsChecks.some((check) => check.domain === "chatgpt.com")).toBe(true);
    expect(plan.egressChecks.some((check) => check.expectedOutboundGroup === "AI-Out")).toBe(true);
    expect(plan.egressChecks.some((check) => check.expectedOutboundGroup === "Process-Proxy")).toBe(
      false,
    );
    expect(plan.appChecks[0]).toMatchObject({
      expectedInbound: "in-proxifier",
      expectedOutboundGroup: "US",
    });
    expect(
      plan.appChecks.some(
        (check) => check.app === "Proxifier" && check.expectedOutboundGroup === "Process-Proxy",
      ),
    ).toBe(true);
    expect(plan.protocolChecks.every((check) => check.expectTCPOnly === true)).toBe(true);
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
      dependencies: {},
      desktop: {
        profile: "system-proxy",
        launchAgentLabel: "org.singbox-iac.runtime",
        tun: {
          autoRoute: true,
          strictRoute: false,
          addresses: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
        },
      },
    },
    listeners: {
      mixed: { enabled: true, listen: "127.0.0.1", port: 39097 },
      proxifier: { enabled: true, listen: "127.0.0.1", port: 39091 },
    },
    ruleSets: [],
    groups: {
      processProxy: { type: "selector", includes: ["US"], defaultTarget: "US" },
      aiOut: { type: "selector", includes: ["HK", "SG", "US"], defaultTarget: "HK" },
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
        {
          id: "proxifier",
          name: "Proxifier",
          url: "https://www.qq.com/favicon.ico",
          inbound: "in-proxifier",
          expectedOutbound: "Process-Proxy",
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
