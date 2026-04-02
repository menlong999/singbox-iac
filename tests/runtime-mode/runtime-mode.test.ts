import { describe, expect, it } from "vitest";

import type { IntentIR } from "../../src/domain/intent.js";
import {
  getRuntimeModeDefaults,
  inferRuntimeMode,
  selectVerificationScenariosForRuntimeMode,
} from "../../src/modules/runtime-mode/index.js";

describe("runtime mode inference", () => {
  it("prefers process-proxy during onboarding when process-aware cues exist", () => {
    expect(
      inferRuntimeMode({
        phase: "onboarding",
        prompt: "Antigravity 进程级走美国，GitHub 走香港",
        intent: {
          version: "v1",
          globals: {},
          sitePolicies: [],
          processPolicies: [
            {
              match: {
                processName: ["Antigravity"],
              },
              inbound: "in-proxifier",
              outboundGroup: "US",
            },
          ],
          localOverrides: {},
        } satisfies IntentIR,
        runInForeground: true,
      }),
    ).toBe("process-proxy");
  });

  it("uses browser-proxy for normal onboarding with only mixed traffic", () => {
    expect(
      inferRuntimeMode({
        phase: "onboarding",
        prompt: "GitHub 走香港，国内直连",
        intent: {
          version: "v1",
          globals: {},
          sitePolicies: [],
          processPolicies: [],
          localOverrides: {},
        } satisfies IntentIR,
        runInForeground: true,
      }),
    ).toBe("browser-proxy");
  });

  it("treats update flow as headless-daemon", () => {
    expect(
      inferRuntimeMode({
        phase: "update",
        runInForeground: false,
      }),
    ).toBe("headless-daemon");
  });
});

describe("runtime mode defaults", () => {
  it("disables visible browser verification by default in headless-daemon mode", () => {
    expect(getRuntimeModeDefaults("headless-daemon")).toMatchObject({
      openVisibleBrowserByDefault: false,
      visibleBrowserScenarioLimit: 0,
      dnsMode: "real-ip",
    });
  });

  it("orders process-aware scenarios first in process-proxy mode", () => {
    const scenarios = selectVerificationScenariosForRuntimeMode("process-proxy", [
      { inbound: "in-mixed" as const, id: "browser" },
      { inbound: "in-proxifier" as const, id: "process" },
    ]);

    expect(scenarios.map((scenario) => scenario.id)).toEqual(["process", "browser"]);
  });

  it("prefers mixed scenarios in browser-proxy mode", () => {
    const scenarios = selectVerificationScenariosForRuntimeMode("browser-proxy", [
      { inbound: "in-proxifier" as const, id: "process" },
      { inbound: "in-mixed" as const, id: "browser" },
    ]);

    expect(scenarios.map((scenario) => scenario.id)).toEqual(["browser"]);
  });
});
