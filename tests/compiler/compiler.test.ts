import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { BuilderConfig } from "../../src/config/schema.js";
import { compileConfig } from "../../src/modules/compiler/index.js";

describe("compileConfig", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("assembles a minimal valid config shape with protected rule ordering", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-rulesets-"));
    tempDirs.push(dir);

    const config: BuilderConfig = {
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
      ruleSets: makeRuleSets(dir),
      groups: {
        processProxy: {
          type: "selector",
          includes: ["US", "SG"],
          defaultNodePattern: "OnlyAI",
        },
        aiOut: { type: "selector", includes: ["HK", "US", "JP"], defaultTarget: "HK" },
        devCommonOut: {
          type: "selector",
          includes: ["HK", "SG", "US"],
          defaultTarget: "HK",
        },
        stitchOut: { type: "selector", includes: ["US", "JP"], defaultTarget: "US" },
        global: { type: "urltest", includes: ["HK", "SG", "US"] },
      },
      rules: {
        userRulesFile: "/tmp/custom.rules.yaml",
      },
      verification: {
        scenarios: [
          {
            id: "stitch-us",
            name: "Google Stitch always uses the dedicated US exit",
            url: "https://stitch.withgoogle.com/favicon.ico",
            inbound: "in-mixed",
            expectedOutbound: "Stitch-Out",
          },
        ],
      },
      schedule: {
        enabled: false,
        intervalMinutes: 30,
      },
    };

    const artifact = compileConfig({
      config,
      nodes: [
        {
          protocol: "trojan",
          tag: "🇭🇰 香港 01",
          server: "hk.example.com",
          serverPort: 443,
          password: "pass-1",
          sni: "hk.example.com",
          insecure: true,
          regionHint: "HK",
        },
        {
          protocol: "trojan",
          tag: "🇺🇸 美国 01",
          server: "us.example.com",
          serverPort: 8443,
          password: "pass-2",
          sni: "us.example.com",
          regionHint: "US",
        },
        {
          protocol: "trojan",
          tag: "🇺🇸 美国 07 - OnlyAI",
          server: "us-onlyai.example.com",
          serverPort: 9443,
          password: "pass-onlyai",
          sni: "us-onlyai.example.com",
          regionHint: "US",
        },
        {
          protocol: "trojan",
          tag: "🇸🇬 新加坡 01",
          server: "sg.example.com",
          serverPort: 10443,
          password: "pass-3",
          sni: "sg.example.com",
          regionHint: "SG",
        },
      ],
    });

    const outbounds = artifact.config.outbounds as Array<Record<string, unknown>>;
    const route = artifact.config.route as {
      rules: Array<Record<string, unknown>>;
      final: string;
      default_domain_resolver: string;
    };
    const dns = artifact.config.dns as {
      servers: Array<Record<string, unknown>>;
      final: string;
      strategy: string;
    };

    expect(outbounds.some((outbound) => outbound.tag === "HK")).toBe(true);
    expect(outbounds.some((outbound) => outbound.tag === "US")).toBe(true);
    expect(outbounds.some((outbound) => outbound.tag === "SG")).toBe(true);
    expect(outbounds.some((outbound) => outbound.tag === "Global")).toBe(true);
    expect(outbounds.some((outbound) => outbound.tag === "Process-Proxy")).toBe(true);
    expect(outbounds.some((outbound) => outbound.tag === "AI-Out")).toBe(true);
    expect(outbounds.some((outbound) => outbound.tag === "Dev-Common-Out")).toBe(true);
    expect(outbounds.some((outbound) => outbound.tag === "Stitch-Out")).toBe(true);
    expect(outbounds.find((outbound) => outbound.tag === "Process-Proxy")).toMatchObject({
      default: "🇺🇸 美国 07 - OnlyAI",
    });
    expect(outbounds.find((outbound) => outbound.tag === "AI-Out")).toMatchObject({
      default: "HK",
    });
    expect(outbounds.find((outbound) => outbound.tag === "Dev-Common-Out")).toMatchObject({
      default: "HK",
    });
    expect(outbounds.find((outbound) => outbound.tag === "Stitch-Out")).toMatchObject({
      default: "US",
    });
    expect(artifact.config.inbounds).toMatchObject([
      { tag: "in-mixed", listen: "127.0.0.1", listen_port: 39097 },
      { tag: "in-proxifier", listen: "127.0.0.1", listen_port: 39091 },
    ]);
    expect(dns.servers).toMatchObject([
      { type: "local", tag: "dns-local-default", prefer_go: true },
      { type: "tcp", tag: "dns-remote-primary", server: "1.1.1.1", server_port: 53 },
      { type: "tcp", tag: "dns-remote-cn", server: "223.5.5.5", server_port: 53 },
    ]);
    expect(dns.final).toBe("dns-local-default");
    expect(dns.strategy).toBe("prefer_ipv4");

    expect(route.rules[0]).toMatchObject({ action: "sniff" });
    expect(route.rules[1]).toMatchObject({ network: "udp", port: 443, action: "reject" });
    expect(route.rules[2]).toMatchObject({ protocol: "dns", action: "hijack-dns" });
    expect(route.rules[3]).toMatchObject({
      inbound: ["in-proxifier"],
      action: "route",
      outbound: "Process-Proxy",
    });
    expect(route.rules[4]).toMatchObject({
      domain_suffix: ["stitch.withgoogle.com"],
      action: "route",
      outbound: "Stitch-Out",
    });
    expect(route.rules[5]).toMatchObject({
      domain_suffix: ["openai.com", "chatgpt.com"],
      action: "route",
      outbound: "AI-Out",
    });
    expect(route.rules[6]).toMatchObject({
      rule_set: ["geosite-google-gemini", "geosite-anthropic"],
      action: "route",
      outbound: "AI-Out",
    });
    expect(route.rules[7]).toMatchObject({
      rule_set: ["geosite-google", "geosite-github", "geosite-github-copilot"],
      action: "route",
      outbound: "Dev-Common-Out",
    });
    expect(route.rules[8]).toMatchObject({
      rule_set: ["geosite-cn", "geoip-cn"],
      action: "route",
      outbound: "direct",
    });
    expect(route.final).toBe("Global");
    expect(route.default_domain_resolver).toBe("dns-local-default");
  });

  it("inserts custom DSL rules before built-ins and validates their outbound targets", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-rulesets-"));
    tempDirs.push(dir);

    const config: BuilderConfig = {
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
      ruleSets: makeRuleSets(dir),
      groups: {
        processProxy: {
          type: "selector",
          includes: ["US", "SG"],
          defaultNodePattern: "OnlyAI",
        },
        aiOut: { type: "selector", includes: ["HK", "US", "JP"], defaultTarget: "HK" },
        devCommonOut: {
          type: "selector",
          includes: ["HK", "SG", "US"],
          defaultTarget: "HK",
        },
        stitchOut: { type: "selector", includes: ["US", "JP"], defaultTarget: "US" },
        global: { type: "urltest", includes: ["HK", "SG", "US"] },
      },
      rules: {
        userRulesFile: "/tmp/custom.rules.yaml",
      },
      verification: {
        scenarios: [
          {
            id: "openrouter-hk",
            name: "OpenRouter uses AI path",
            url: "https://openrouter.ai/favicon.ico",
            inbound: "in-mixed",
            expectedOutbound: "AI-Out",
          },
        ],
      },
      schedule: {
        enabled: false,
        intervalMinutes: 30,
      },
    };

    const artifact = compileConfig({
      config,
      userRules: {
        beforeBuiltins: [
          {
            name: "OpenRouter uses AI path",
            domainSuffix: ["openrouter.ai"],
            route: "AI-Out",
          },
        ],
        afterBuiltins: [],
        warnings: [],
      },
      nodes: [
        {
          protocol: "trojan",
          tag: "🇭🇰 香港 01",
          server: "hk.example.com",
          serverPort: 443,
          password: "pass-1",
          sni: "hk.example.com",
          insecure: true,
          regionHint: "HK",
        },
        {
          protocol: "trojan",
          tag: "🇺🇸 美国 01",
          server: "us.example.com",
          serverPort: 8443,
          password: "pass-2",
          sni: "us.example.com",
          regionHint: "US",
        },
      ],
    });

    const route = artifact.config.route as {
      rules: Array<Record<string, unknown>>;
    };

    expect(route.rules[4]).toMatchObject({
      domain_suffix: ["openrouter.ai"],
      action: "route",
      outbound: "AI-Out",
    });
    expect(route.rules[5]).toMatchObject({
      domain_suffix: ["stitch.withgoogle.com"],
      action: "route",
      outbound: "Stitch-Out",
    });
  });

  it("prefers defaultNodePattern over a coarse defaultTarget when both are configured", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-pattern-priority-"));
    tempDirs.push(dir);

    const config: BuilderConfig = {
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
      ruleSets: makeRuleSets(dir),
      groups: {
        processProxy: {
          type: "selector",
          includes: ["US", "SG"],
          defaultTarget: "US",
          defaultNodePattern: "OnlyAI",
        },
        aiOut: { type: "selector", includes: ["HK", "US"], defaultTarget: "HK" },
        devCommonOut: { type: "selector", includes: ["HK", "US"], defaultTarget: "HK" },
        stitchOut: { type: "selector", includes: ["US"], defaultTarget: "US" },
        global: { type: "urltest", includes: ["HK", "US"] },
      },
      rules: {
        userRulesFile: "/tmp/custom.rules.yaml",
      },
      verification: {
        scenarios: [],
      },
      schedule: {
        enabled: false,
        intervalMinutes: 30,
      },
    };

    const artifact = compileConfig({
      config,
      nodes: [
        {
          protocol: "trojan",
          tag: "🇺🇸 美国 01",
          server: "us.example.com",
          serverPort: 8443,
          password: "pass-1",
          sni: "us.example.com",
          regionHint: "US",
        },
        {
          protocol: "trojan",
          tag: "🇺🇸 美国 07 - OnlyAI",
          server: "us-onlyai.example.com",
          serverPort: 9443,
          password: "pass-2",
          sni: "us-onlyai.example.com",
          regionHint: "US",
        },
        {
          protocol: "trojan",
          tag: "🇸🇬 新加坡 01",
          server: "sg.example.com",
          serverPort: 10443,
          password: "pass-3",
          sni: "sg.example.com",
          regionHint: "SG",
        },
      ],
    });

    expect(
      (artifact.config.outbounds as Array<Record<string, unknown>>).find(
        (outbound) => outbound.tag === "Process-Proxy",
      ),
    ).toMatchObject({
      default: "🇺🇸 美国 07 - OnlyAI",
    });
  });
});

function makeRuleSets(dir: string): BuilderConfig["ruleSets"] {
  const tags = [
    "geosite-cn",
    "geoip-cn",
    "geosite-google",
    "geosite-google-gemini",
    "geosite-anthropic",
    "geosite-github",
    "geosite-github-copilot",
  ] as const;

  return tags.map((tag) => {
    const filePath = path.join(dir, `${tag}.srs`);
    writeFileSync(filePath, "SRS-test");
    return {
      tag,
      format: "binary" as const,
      type: "local" as const,
      path: filePath,
    };
  });
}
