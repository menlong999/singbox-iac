import { describe, expect, it, vi } from "vitest";

import type { BuilderConfig } from "../../src/config/schema.js";
import { collectDiagnosticsReport } from "../../src/modules/diagnostics/index.js";
import type { StatusReport } from "../../src/modules/status/index.js";

describe("diagnostics module", () => {
  it("collects healthy runtime and DNS evidence", async () => {
    const report = await collectDiagnosticsReport({
      config: createConfig(),
      configPath: "/tmp/builder.config.yaml",
      statusCollector: vi.fn().mockResolvedValue(createHealthyStatusReport()),
      commandRunner: vi
        .fn()
        .mockResolvedValueOnce({
          stdout: "   route to: default\ninterface: en0\ngateway: 192.168.31.1\n",
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: "resolver #1\n  nameserver[0] : 223.5.5.5\n  nameserver[1] : 1.1.1.1\n",
          stderr: "",
        }),
      dnsLookup: vi.fn().mockResolvedValue(["104.18.33.45"]),
    });

    expect(report.summary).toEqual({ pass: 10, warn: 0, fail: 0 });
    expect(report.checks.find((check) => check.name === "default-route")?.status).toBe("PASS");
    expect(report.checks.find((check) => check.name === "system-dns")?.status).toBe("PASS");
    expect(report.checks.find((check) => check.name === "dns-probe:chatgpt.com")?.status).toBe(
      "PASS",
    );
  });

  it("warns when DNS evidence looks suspicious", async () => {
    const report = await collectDiagnosticsReport({
      config: createConfig(),
      configPath: "/tmp/builder.config.yaml",
      statusCollector: vi.fn().mockResolvedValue(createHealthyStatusReport()),
      commandRunner: vi
        .fn()
        .mockRejectedValueOnce(new Error("default route unavailable"))
        .mockResolvedValueOnce({
          stdout: "resolver #1\n",
          stderr: "",
        }),
      dnsLookup: vi.fn().mockResolvedValue(["127.0.0.1"]),
    });

    expect(report.checks.find((check) => check.name === "default-route")?.status).toBe("WARN");
    expect(report.checks.find((check) => check.name === "system-dns")?.status).toBe("WARN");
    expect(report.checks.find((check) => check.name === "dns-probe:chatgpt.com")?.status).toBe(
      "WARN",
    );
  });

  it("falls back to /sbin/route when /usr/sbin/route is unavailable", async () => {
    const commandRunner = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("spawn /usr/sbin/route ENOENT"), { code: "ENOENT" }),
      )
      .mockResolvedValueOnce({
        stdout: "   route to: default\ninterface: en0\ngateway: 192.168.31.1\n",
        stderr: "",
      })
      .mockResolvedValueOnce({
        stdout: "resolver #1\n  nameserver[0] : 223.5.5.5\n",
        stderr: "",
      });

    const report = await collectDiagnosticsReport({
      config: createConfig(),
      configPath: "/tmp/builder.config.yaml",
      statusCollector: vi.fn().mockResolvedValue(createHealthyStatusReport()),
      commandRunner,
      dnsLookup: vi.fn().mockResolvedValue(["104.18.33.45"]),
    });

    expect(report.checks.find((check) => check.name === "default-route")?.status).toBe("PASS");
    expect(commandRunner).toHaveBeenNthCalledWith(1, "/usr/sbin/route", ["-n", "get", "default"]);
    expect(commandRunner).toHaveBeenNthCalledWith(2, "/sbin/route", ["-n", "get", "default"]);
  });
});

function createConfig(): BuilderConfig {
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
        includes: ["US"],
      },
      aiOut: {
        type: "selector",
        includes: ["HK"],
      },
      devCommonOut: {
        type: "selector",
        includes: ["HK"],
      },
      stitchOut: {
        type: "selector",
        includes: ["US"],
      },
      global: {
        type: "selector",
        includes: ["HK"],
      },
    },
    rules: {
      userRulesFile: "/tmp/custom.rules.yaml",
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
      intervalMinutes: 30,
    },
    authoring: {
      provider: "deterministic",
      timeoutMs: 4000,
    },
  };
}

function createHealthyStatusReport(): StatusReport {
  return {
    generatedAt: "2026-04-08T15:00:00.000Z",
    builderConfigPath: "/tmp/builder.config.yaml",
    runtime: {
      processRunning: true,
      processIds: [22608],
      runtimeLabel: "org.singbox-iac.runtime",
      launchAgentInstalled: true,
      launchAgentLoaded: true,
      systemProxyActive: true,
      systemProxy: {
        state: "active",
        drift: false,
        expected: { host: "127.0.0.1", port: 39097 },
        actual: [
          { kind: "http", enabled: true, host: "127.0.0.1", port: 39097 },
          { kind: "https", enabled: true, host: "127.0.0.1", port: 39097 },
          { kind: "socks", enabled: true, host: "127.0.0.1", port: 39097 },
        ],
      },
      listeners: [
        { tag: "in-mixed", listen: "127.0.0.1", port: 39097, active: true },
        { tag: "in-proxifier", listen: "127.0.0.1", port: 39091, active: true },
      ],
    },
    config: {
      livePath: "/tmp/live.json",
      liveExists: true,
    },
    scheduler: {
      enabled: true,
      label: "org.singbox-iac.update",
      installed: true,
      loaded: true,
      plistPath: "/tmp/org.singbox-iac.update.plist",
    },
    history: {
      lastTransactionId: "tx-1",
      lastTransactionStatus: "applied",
      lastTransactionAt: "2026-04-08T14:59:00.000Z",
    },
    diagnostics: [],
  };
}
