import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { BuilderConfig } from "../../src/config/schema.js";
import {
  readRuntimeWatchdogState,
  runRuntimeWatchdogTick,
} from "../../src/modules/runtime-watchdog/index.js";

describe("runtime watchdog", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reasserts proxy drift and records a successful watchdog result", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-watchdog-"));
    tempDirs.push(dir);

    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({
        stdout:
          "An asterisk (*) denotes that a network service is disabled.\nWi-Fi\nUSB 10/100/1000 LAN\n",
        stderr: "",
      })
      .mockResolvedValue({ stdout: "", stderr: "" });

    const snapshotCollector = vi
      .fn()
      .mockResolvedValueOnce({
        processRunning: true,
        processIds: [22608],
        listenerActive: true,
        systemProxy: {
          expected: {
            host: "127.0.0.1",
            port: 39097,
          },
          actual: [
            { kind: "http", enabled: false },
            { kind: "https", enabled: false },
            { kind: "socks", enabled: false },
          ],
          state: "inactive" as const,
          drift: true,
          nextAction: "Run `singbox-iac restart` to let sing-box reassert the macOS system proxy.",
        },
      })
      .mockResolvedValueOnce({
        processRunning: true,
        processIds: [22608],
        listenerActive: true,
        systemProxy: {
          expected: {
            host: "127.0.0.1",
            port: 39097,
          },
          actual: [
            { kind: "http", enabled: true, host: "127.0.0.1", port: 39097 },
            { kind: "https", enabled: true, host: "127.0.0.1", port: 39097 },
            { kind: "socks", enabled: true, host: "127.0.0.1", port: 39097 },
          ],
          state: "active" as const,
          drift: false,
        },
      });

    const statePath = path.join(dir, "watchdog-state.json");
    const result = await runRuntimeWatchdogTick({
      config: createConfig(),
      configPath: path.join(dir, "builder.config.yaml"),
      statePath,
      snapshotCollector,
      commandRunner,
    });

    expect(result.state.lastResult).toBe("reasserted");
    expect(result.state.lastMessage).toContain("Reasserted");
    expect(result.state.lastTrigger).toBe("proxy-drift");
    expect(result.state.lastRecoveryAction).toBe("reassert-proxy");
    expect(result.state.lastReassertAt).toBeDefined();
    expect(snapshotCollector).toHaveBeenCalledTimes(2);
    expect(commandRunner).toHaveBeenCalledWith("/usr/sbin/networksetup", [
      "-listallnetworkservices",
    ]);
    expect(commandRunner).toHaveBeenCalledWith("/usr/sbin/networksetup", [
      "-setwebproxy",
      "Wi-Fi",
      "127.0.0.1",
      "39097",
      "off",
    ]);
    expect(commandRunner).toHaveBeenCalledWith("/usr/sbin/networksetup", [
      "-setsecurewebproxy",
      "USB 10/100/1000 LAN",
      "127.0.0.1",
      "39097",
      "off",
    ]);
    expect(commandRunner).toHaveBeenCalledWith("/usr/sbin/networksetup", [
      "-setsocksfirewallproxy",
      "Wi-Fi",
      "127.0.0.1",
      "39097",
      "off",
    ]);

    const persisted = await readRuntimeWatchdogState(statePath);
    expect(persisted?.lastResult).toBe("reasserted");
  });

  it("restarts the runtime when proxy drift survives proxy reassert", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-watchdog-"));
    tempDirs.push(dir);

    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({
        stdout:
          "An asterisk (*) denotes that a network service is disabled.\nWi-Fi\nUSB 10/100/1000 LAN\n",
        stderr: "",
      })
      .mockResolvedValue({ stdout: "", stderr: "" });
    const runtimeAgentRecoverer = vi.fn().mockResolvedValue({
      label: "org.singbox-iac.runtime",
      plistPath: path.join(dir, "LaunchAgents", "org.singbox-iac.runtime.plist"),
      method: "kickstart" as const,
    });
    const snapshotCollector = vi
      .fn()
      .mockResolvedValueOnce({
        processRunning: true,
        processIds: [22608],
        listenerActive: true,
        systemProxy: {
          expected: {
            host: "127.0.0.1",
            port: 39097,
          },
          actual: [
            { kind: "http", enabled: false },
            { kind: "https", enabled: false },
            { kind: "socks", enabled: false },
          ],
          state: "inactive" as const,
          drift: true,
        },
      })
      .mockResolvedValueOnce({
        processRunning: true,
        processIds: [22608],
        listenerActive: true,
        systemProxy: {
          expected: {
            host: "127.0.0.1",
            port: 39097,
          },
          actual: [
            { kind: "http", enabled: false },
            { kind: "https", enabled: false },
            { kind: "socks", enabled: false },
          ],
          state: "inactive" as const,
          drift: true,
        },
      })
      .mockResolvedValueOnce({
        processRunning: true,
        processIds: [22608],
        listenerActive: true,
        systemProxy: {
          expected: {
            host: "127.0.0.1",
            port: 39097,
          },
          actual: [
            { kind: "http", enabled: true, host: "127.0.0.1", port: 39097 },
            { kind: "https", enabled: true, host: "127.0.0.1", port: 39097 },
            { kind: "socks", enabled: true, host: "127.0.0.1", port: 39097 },
          ],
          state: "active" as const,
          drift: false,
        },
      });

    const statePath = path.join(dir, "watchdog-state.json");
    const result = await runRuntimeWatchdogTick({
      config: createConfig(),
      configPath: path.join(dir, "builder.config.yaml"),
      statePath,
      snapshotCollector,
      commandRunner,
      runtimeAgentRecoverer,
    });

    expect(result.state.lastResult).toBe("restarted");
    expect(result.state.lastTrigger).toBe("proxy-drift");
    expect(result.state.lastRecoveryAction).toBe("restart-runtime");
    expect(result.state.lastRestartAt).toBeDefined();
    expect(snapshotCollector).toHaveBeenCalledTimes(3);
    expect(runtimeAgentRecoverer).toHaveBeenCalledWith({
      label: "org.singbox-iac.runtime",
    });
  });

  it("skips repeated runtime restarts while the cooldown is active", async () => {
    vi.useFakeTimers();

    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-watchdog-"));
    tempDirs.push(dir);

    const runtimeAgentRecoverer = vi.fn().mockResolvedValue({
      label: "org.singbox-iac.runtime",
      plistPath: path.join(dir, "LaunchAgents", "org.singbox-iac.runtime.plist"),
      method: "kickstart" as const,
    });
    const snapshotCollector = vi
      .fn()
      .mockResolvedValueOnce({
        processRunning: false,
        processIds: [],
        listenerActive: false,
        systemProxy: {
          expected: {
            host: "127.0.0.1",
            port: 39097,
          },
          actual: [
            { kind: "http", enabled: false },
            { kind: "https", enabled: false },
            { kind: "socks", enabled: false },
          ],
          state: "inactive" as const,
          drift: false,
        },
      })
      .mockResolvedValueOnce({
        processRunning: true,
        processIds: [22608],
        listenerActive: true,
        systemProxy: {
          expected: {
            host: "127.0.0.1",
            port: 39097,
          },
          actual: [
            { kind: "http", enabled: true, host: "127.0.0.1", port: 39097 },
            { kind: "https", enabled: true, host: "127.0.0.1", port: 39097 },
            { kind: "socks", enabled: true, host: "127.0.0.1", port: 39097 },
          ],
          state: "active" as const,
          drift: false,
        },
      })
      .mockResolvedValueOnce({
        processRunning: false,
        processIds: [],
        listenerActive: false,
        systemProxy: {
          expected: {
            host: "127.0.0.1",
            port: 39097,
          },
          actual: [
            { kind: "http", enabled: false },
            { kind: "https", enabled: false },
            { kind: "socks", enabled: false },
          ],
          state: "inactive" as const,
          drift: false,
        },
      });

    const statePath = path.join(dir, "watchdog-state.json");

    vi.setSystemTime(new Date("2026-04-08T10:00:00.000Z"));
    const first = await runRuntimeWatchdogTick({
      config: createConfig(),
      configPath: path.join(dir, "builder.config.yaml"),
      statePath,
      snapshotCollector,
      runtimeAgentRecoverer,
    });

    vi.setSystemTime(new Date("2026-04-08T10:02:00.000Z"));
    const second = await runRuntimeWatchdogTick({
      config: createConfig(),
      configPath: path.join(dir, "builder.config.yaml"),
      statePath,
      snapshotCollector,
      runtimeAgentRecoverer,
    });

    expect(first.state.lastResult).toBe("restarted");
    expect(first.state.lastRestartAt).toBe("2026-04-08T10:00:00.000Z");
    expect(second.state.lastResult).toBe("restart-skipped-cooldown");
    expect(second.state.lastTrigger).toBe("process-missing");
    expect(second.state.lastRestartAt).toBe("2026-04-08T10:00:00.000Z");
    expect(runtimeAgentRecoverer).toHaveBeenCalledTimes(1);
  });

  it("does not rewrite the watchdog state file when the recorded result stays healthy", async () => {
    vi.useFakeTimers();

    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-watchdog-"));
    tempDirs.push(dir);

    const statePath = path.join(dir, "watchdog-state.json");
    const snapshotCollector = vi.fn().mockResolvedValue({
      processRunning: true,
      processIds: [22608],
      listenerActive: true,
      systemProxy: {
        expected: {
          host: "127.0.0.1",
          port: 39097,
        },
        actual: [
          { kind: "http", enabled: true, host: "127.0.0.1", port: 39097 },
          { kind: "https", enabled: true, host: "127.0.0.1", port: 39097 },
          { kind: "socks", enabled: true, host: "127.0.0.1", port: 39097 },
        ],
        state: "active" as const,
        drift: false,
      },
    });

    vi.setSystemTime(new Date("2026-04-08T10:00:00.000Z"));
    const first = await runRuntimeWatchdogTick({
      config: createConfig(),
      configPath: path.join(dir, "builder.config.yaml"),
      statePath,
      snapshotCollector,
    });

    vi.setSystemTime(new Date("2026-04-08T10:01:00.000Z"));
    const second = await runRuntimeWatchdogTick({
      config: createConfig(),
      configPath: path.join(dir, "builder.config.yaml"),
      statePath,
      snapshotCollector,
    });

    expect(first.state.lastResult).toBe("healthy");
    expect(second.state.lastResult).toBe("healthy");
    expect(second.state.lastCheckedAt).toBe(first.state.lastCheckedAt);

    const persisted = await readRuntimeWatchdogState(statePath);
    expect(persisted?.lastCheckedAt).toBe(first.state.lastCheckedAt);
    expect(snapshotCollector).toHaveBeenCalledTimes(2);
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
          id: "smoke",
          name: "Smoke",
          url: "https://example.com",
          inbound: "in-mixed",
          expectedOutbound: "HK",
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
