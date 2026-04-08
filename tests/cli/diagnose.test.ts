import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/modules/diagnostics/index.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/modules/diagnostics/index.js")>(
    "../../src/modules/diagnostics/index.js",
  );

  return {
    ...actual,
    collectDiagnosticsReport: vi.fn(),
  };
});

import { createProgram } from "../../src/cli/index.js";
import {
  type DiagnosticsReport,
  collectDiagnosticsReport,
} from "../../src/modules/diagnostics/index.js";

describe("diagnose command", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints a healthy diagnostics summary", async () => {
    vi.mocked(collectDiagnosticsReport).mockResolvedValue(createHealthyReport());

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await createProgram().parseAsync(["node", "singbox-iac", "diagnose"]);

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain(
      "Network triage: runtime summary plus local route, DNS, and domain-resolution evidence.",
    );
    expect(output).toContain("Summary:");
    expect(output).toContain("checks: PASS 8 WARN 0 FAIL 0");
    expect(output).toContain("assessment: No immediate network issue detected.");
    expect(output).toContain("Runtime Summary:");
    expect(output).toContain("[PASS] runtime-process: running (22608)");
    expect(output).toContain("Network Evidence:");
    expect(output).toContain("[PASS] default-route: interface=en0, gateway=192.168.31.1");
    expect(output).toContain("Suggested Next Step:");
    expect(output).toContain("Status Diagnostics:");
    expect(output).toContain("No status diagnostics were recorded");
  });

  it("prints warnings for unhealthy local-network diagnostics", async () => {
    vi.mocked(collectDiagnosticsReport).mockResolvedValue(createUnhealthyReport());

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await createProgram().parseAsync(["node", "singbox-iac", "diagnose"]);

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("checks: PASS 2 WARN 4 FAIL 0");
    expect(output).toContain("assessment: Mixed evidence across runtime and local network.");
    expect(output).toContain("Runtime Summary:");
    expect(output).toContain("[WARN] system-proxy:");
    expect(output).toContain("Network Evidence:");
    expect(output).toContain("[WARN] dns-probe:chatgpt.com:");
    expect(output).toContain("Suggested Next Step:");
    expect(output).toContain("[warn] Desktop runtime is running in system-proxy mode");
  });
});

function createHealthyReport(): DiagnosticsReport {
  return {
    generatedAt: "2026-04-08T15:00:00.000Z",
    builderConfigPath: "/tmp/builder.config.yaml",
    summary: {
      pass: 8,
      warn: 0,
      fail: 0,
    },
    checks: [
      { status: "PASS", name: "runtime-process", details: "running (22608)" },
      {
        status: "PASS",
        name: "listener:in-mixed",
        details: "127.0.0.1:39097 accepting connections",
      },
      {
        status: "PASS",
        name: "listener:in-proxifier",
        details: "127.0.0.1:39091 accepting connections",
      },
      { status: "PASS", name: "live-config", details: "/tmp/live.json [present]" },
      { status: "PASS", name: "schedule", details: "org.singbox-iac.update installed loaded=true" },
      {
        status: "PASS",
        name: "latest-transaction",
        details: "tx-1 applied at 2026-04-08T14:59:00.000Z",
      },
      { status: "PASS", name: "default-route", details: "interface=en0, gateway=192.168.31.1" },
      { status: "PASS", name: "system-dns", details: "nameservers=223.5.5.5, 1.1.1.1" },
    ],
    status: {
      generatedAt: "2026-04-08T15:00:00.000Z",
      builderConfigPath: "/tmp/builder.config.yaml",
      runtime: {
        processRunning: true,
        processIds: [22608],
        runtimeLabel: "org.singbox-iac.runtime",
        launchAgentInstalled: true,
        launchAgentLoaded: true,
        listeners: [],
      },
      config: {
        liveExists: true,
      },
      scheduler: {
        enabled: true,
        label: "org.singbox-iac.update",
        installed: true,
        loaded: true,
        plistPath: "/tmp/org.singbox-iac.update.plist",
      },
      history: {},
      diagnostics: [],
    },
  };
}

function createUnhealthyReport(): DiagnosticsReport {
  return {
    generatedAt: "2026-04-08T15:05:00.000Z",
    summary: {
      pass: 2,
      warn: 4,
      fail: 0,
    },
    checks: [
      { status: "PASS", name: "runtime-process", details: "running (22608)" },
      {
        status: "PASS",
        name: "listener:in-mixed",
        details: "127.0.0.1:39097 accepting connections",
      },
      {
        status: "WARN",
        name: "system-proxy",
        details: "state=endpoint-mismatch, expected=127.0.0.1:39097, actual=http=127.0.0.1:8888",
      },
      { status: "WARN", name: "default-route", details: "route command failed" },
      {
        status: "WARN",
        name: "system-dns",
        details: "No nameservers were parsed from `scutil --dns`.",
      },
      {
        status: "WARN",
        name: "dns-probe:chatgpt.com",
        details: "Resolved only suspicious addresses: 127.0.0.1",
      },
    ],
    status: {
      generatedAt: "2026-04-08T15:05:00.000Z",
      runtime: {
        processRunning: true,
        processIds: [22608],
        runtimeLabel: "org.singbox-iac.runtime",
        launchAgentInstalled: true,
        launchAgentLoaded: true,
        listeners: [],
      },
      config: {
        liveExists: true,
      },
      scheduler: {
        enabled: false,
        label: "org.singbox-iac.update",
        installed: false,
        plistPath: "/tmp/org.singbox-iac.update.plist",
      },
      history: {},
      diagnostics: [
        {
          level: "warn",
          message:
            "Desktop runtime is running in system-proxy mode, but macOS proxy state is http=127.0.0.1:8888 instead of 127.0.0.1:39097.",
        },
      ],
    },
  };
}
