import { describe, expect, it } from "vitest";

import {
  isRouteLevelProxySuccess,
  prepareVerificationConfig,
  resolveDefaultLeafOutboundTag,
  validateConfigInvariants,
} from "../../src/modules/verification/index.js";

describe("verification helpers", () => {
  it("resolves selector chains to concrete outbounds and prepares a deterministic verify config", async () => {
    const baseConfig = {
      log: { level: "info" },
      dns: {
        servers: [
          { type: "local", tag: "dns-local-default" },
          { type: "udp", tag: "dns-remote-primary", server: "1.1.1.1", server_port: 53 },
          { type: "udp", tag: "dns-remote-cn", server: "223.5.5.5", server_port: 53 },
        ],
        final: "dns-local-default",
        strategy: "prefer_ipv4",
      },
      inbounds: [
        { type: "mixed", tag: "in-mixed", listen: "127.0.0.1", listen_port: 39097 },
        { type: "mixed", tag: "in-proxifier", listen: "127.0.0.1", listen_port: 39091 },
      ],
      outbounds: [
        { type: "trojan", tag: "🇺🇸 美国 01", server: "us.example.com", server_port: 443 },
        {
          type: "trojan",
          tag: "🇺🇸 美国 07 - OnlyAI",
          server: "us-onlyai.example.com",
          server_port: 443,
        },
        { type: "trojan", tag: "🇭🇰 香港 01", server: "hk.example.com", server_port: 443 },
        {
          type: "selector",
          tag: "US",
          outbounds: ["🇺🇸 美国 01", "🇺🇸 美国 07 - OnlyAI", "direct"],
          default: "🇺🇸 美国 01",
        },
        { type: "selector", tag: "HK", outbounds: ["🇭🇰 香港 01", "direct"], default: "🇭🇰 香港 01" },
        {
          type: "urltest",
          tag: "Global",
          outbounds: ["HK", "US"],
          interval: "10m",
          url: "https://www.gstatic.com/generate_204",
        },
        {
          type: "selector",
          tag: "AI-Out",
          outbounds: ["HK", "US", "Global", "direct"],
          default: "HK",
        },
        {
          type: "selector",
          tag: "Dev-Common-Out",
          outbounds: ["HK", "US", "Global", "direct"],
          default: "HK",
        },
        {
          type: "selector",
          tag: "Stitch-Out",
          outbounds: ["US", "Global", "direct"],
          default: "US",
        },
        {
          type: "selector",
          tag: "Process-Proxy",
          outbounds: ["🇺🇸 美国 07 - OnlyAI", "US", "Global", "direct"],
          default: "🇺🇸 美国 07 - OnlyAI",
        },
        { type: "direct", tag: "direct" },
      ],
      route: {
        rules: [
          { action: "sniff" },
          { network: "udp", port: 443, action: "reject" },
          { protocol: "dns", action: "hijack-dns" },
          { inbound: ["in-proxifier"], action: "route", outbound: "Process-Proxy" },
          { domain_suffix: ["stitch.withgoogle.com"], action: "route", outbound: "Stitch-Out" },
          { domain_suffix: ["openai.com", "chatgpt.com"], action: "route", outbound: "AI-Out" },
          { rule_set: ["geosite-google-gemini"], action: "route", outbound: "AI-Out" },
          { rule_set: ["geosite-github"], action: "route", outbound: "Dev-Common-Out" },
          { rule_set: ["geosite-cn", "geoip-cn"], action: "route", outbound: "direct" },
        ],
        final: "Global",
        auto_detect_interface: true,
        default_domain_resolver: "dns-local-default",
      },
    };

    expect(resolveDefaultLeafOutboundTag(baseConfig, "AI-Out")).toBe("🇭🇰 香港 01");
    expect(resolveDefaultLeafOutboundTag(baseConfig, "Process-Proxy")).toBe("🇺🇸 美国 07 - OnlyAI");

    const prepared = await prepareVerificationConfig(baseConfig);
    expect((prepared.config.log as { level: string }).level).toBe("debug");
    expect(prepared.mixedPort).not.toBe(39097);
    expect(prepared.proxifierPort).not.toBe(39091);
    expect(
      (prepared.config.outbounds as Array<{ tag: string; type: string }>).find(
        (outbound) => outbound.tag === "Global",
      )?.type,
    ).toBe("selector");
    expect((prepared.config.dns as { final: string }).final).toBe("dns-local-verify");
    expect(
      (
        prepared.config.dns as {
          servers: Array<{ type: string; tag: string }>;
        }
      ).servers[0],
    ).toMatchObject({
      type: "local",
      tag: "dns-local-verify",
    });
    expect(
      (prepared.config.route as { default_domain_resolver: string }).default_domain_resolver,
    ).toBe("dns-local-verify");

    const checks = validateConfigInvariants(baseConfig);
    expect(checks.every((check) => check.passed)).toBe(true);
  });

  it("allows optional ruleset-driven route checks to be absent", () => {
    const config = {
      dns: {
        servers: [
          { type: "local", tag: "dns-local-default" },
          { type: "tcp", tag: "dns-remote-primary", server: "1.1.1.1", server_port: 53 },
          { type: "tcp", tag: "dns-remote-cn", server: "223.5.5.5", server_port: 53 },
        ],
      },
      route: {
        default_domain_resolver: "dns-local-default",
        rules: [
          { action: "sniff" },
          { network: "udp", port: 443, action: "reject" },
          { protocol: "dns", action: "hijack-dns" },
          { inbound: ["in-proxifier"], action: "route", outbound: "Process-Proxy" },
          { domain_suffix: ["stitch.withgoogle.com"], action: "route", outbound: "Stitch-Out" },
          { domain_suffix: ["openai.com", "chatgpt.com"], action: "route", outbound: "AI-Out" },
        ],
      },
    };

    const checks = validateConfigInvariants(config);
    expect(checks.every((check) => check.passed)).toBe(true);
  });

  it("rewrites tun inbounds into an unprivileged mixed listener during verification", async () => {
    const baseConfig = {
      log: { level: "info" },
      dns: {
        servers: [
          { type: "local", tag: "dns-local-default" },
          { type: "udp", tag: "dns-remote-primary", server: "1.1.1.1", server_port: 53 },
          { type: "udp", tag: "dns-remote-cn", server: "223.5.5.5", server_port: 53 },
          { type: "fakeip", tag: "dns-fakeip", inet4_range: "198.18.0.0/15" },
        ],
        final: "dns-local-default",
        rules: [{ query_type: ["A", "AAAA"], server: "dns-fakeip" }],
      },
      inbounds: [
        {
          type: "mixed",
          tag: "in-mixed",
          listen: "127.0.0.1",
          listen_port: 39097,
        },
        {
          type: "mixed",
          tag: "in-proxifier",
          listen: "127.0.0.1",
          listen_port: 39091,
        },
        {
          type: "tun",
          tag: "in-tun",
          interface_name: "utun9",
          address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
          auto_route: true,
          strict_route: false,
        },
      ],
      outbounds: [{ type: "direct", tag: "direct" }],
      experimental: {
        cache_file: {
          enabled: true,
          path: "/tmp/tun-cache.db",
          store_fakeip: true,
        },
      },
      route: {
        rules: [
          { network: "udp", port: 443, action: "reject" },
          { protocol: "dns", action: "hijack-dns" },
        ],
        final: "direct",
        default_domain_resolver: "dns-local-default",
      },
    };

    const prepared = await prepareVerificationConfig(baseConfig);
    expect(prepared.config.inbounds).toEqual([
      {
        type: "mixed",
        tag: "in-mixed",
        listen: "127.0.0.1",
        listen_port: prepared.mixedPort,
      },
      {
        type: "mixed",
        tag: "in-proxifier",
        listen: "127.0.0.1",
        listen_port: prepared.proxifierPort,
      },
      {
        type: "mixed",
        tag: "in-tun",
        listen: "127.0.0.1",
        listen_port: expect.any(Number),
      },
    ]);
    expect(
      (prepared.config.inbounds as Array<{ tag: string; listen_port: number }>).find(
        (inbound) => inbound.tag === "in-tun",
      )?.listen_port,
    ).not.toBe(prepared.mixedPort);
    expect(
      (prepared.config.inbounds as Array<{ tag: string; listen_port: number }>).find(
        (inbound) => inbound.tag === "in-tun",
      )?.listen_port,
    ).not.toBe(prepared.proxifierPort);
    expect(prepared.config.dns).toEqual({
      servers: [{ type: "local", tag: "dns-local-verify" }],
      rules: [],
      final: "dns-local-verify",
      reverse_mapping: false,
    });
    expect(prepared.config.experimental).toBeUndefined();
  });

  it("treats proxifier CONNECT establishment as a route-level success for timeout-prone upstreams", () => {
    expect(
      isRouteLevelProxySuccess(
        { inboundTag: "in-proxifier" },
        {
          exitCode: 28,
          stdout: "HTTP/1.1 200 Connection established\n",
          stderr: "curl: (28) SSL connection timeout",
          timedOut: false,
        },
      ),
    ).toBe(true);

    expect(
      isRouteLevelProxySuccess(
        { inboundTag: "in-mixed" },
        {
          exitCode: 28,
          stdout: "HTTP/1.1 200 Connection established\n",
          stderr: "curl: (28) SSL connection timeout",
          timedOut: false,
        },
      ),
    ).toBe(false);
  });
});
