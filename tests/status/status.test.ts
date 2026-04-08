import { describe, expect, it } from "vitest";

import { assessSystemProxyState } from "../../src/modules/status/index.js";

describe("status system-proxy drift assessment", () => {
  const expected = { host: "127.0.0.1", port: 39097 } as const;

  it("reports drift when the runtime is running but no macOS proxy is enabled", () => {
    const report = assessSystemProxyState({
      processRunning: true,
      listenerActive: true,
      expected,
      actual: [
        { kind: "http", enabled: false },
        { kind: "https", enabled: false },
        { kind: "socks", enabled: false },
      ],
    });

    expect(report.state).toBe("inactive");
    expect(report.drift).toBe(true);
    expect(report.nextAction).toContain("singbox-iac restart");
  });

  it("reports drift when the runtime is running but the proxy endpoint does not match", () => {
    const report = assessSystemProxyState({
      processRunning: true,
      listenerActive: true,
      expected,
      actual: [
        { kind: "http", enabled: true, host: "127.0.0.1", port: 8888 },
        { kind: "https", enabled: false },
        { kind: "socks", enabled: true, host: "127.0.0.1", port: 39097 },
      ],
    });

    expect(report.state).toBe("endpoint-mismatch");
    expect(report.drift).toBe(true);
    expect(report.nextAction).toContain("conflicting proxy app");
  });
});
