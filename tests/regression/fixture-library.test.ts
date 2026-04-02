import { describe, expect, it } from "vitest";

import { intentFromUserRules } from "../../src/modules/intent/index.js";
import { loadUserRules } from "../../src/modules/user-rules/index.js";
import {
  buildRegressionFixtureArtifacts,
  listRegressionFixtures,
  readFixtureSnapshot,
} from "./fixture-library.js";

const fixtures = listRegressionFixtures();

describe("regression fixture library", () => {
  for (const fixture of fixtures) {
    it(`${fixture.id} matches compiled config and verification plan snapshots`, () => {
      const artifacts = buildRegressionFixtureArtifacts(fixture);

      try {
        expect(artifacts.compiledConfig).toEqual(
          readFixtureSnapshot<Record<string, unknown>>(fixture.compiledConfigPath),
        );
        expect(artifacts.verificationPlan).toEqual(
          readFixtureSnapshot(fixture.verificationPlanPath),
        );

        assertFixtureBehavior(
          fixture.id,
          artifacts.compiledConfig,
          artifacts.verificationPlan as {
            routeChecks: Array<Record<string, unknown>>;
            dnsChecks: Array<Record<string, unknown>>;
            egressChecks: Array<Record<string, unknown>>;
            appChecks: Array<Record<string, unknown>>;
          },
        );
      } finally {
        artifacts.cleanup();
      }
    });

    if (fixture.dslPath) {
      it(`${fixture.id} DSL input still compiles to the expected site intent`, async () => {
        const loadedRules = await loadUserRules(fixture.dslPath);
        const dslIntent = intentFromUserRules(loadedRules);
        expect(dslIntent.sitePolicies).toEqual(fixture.intent.sitePolicies);
        expect(dslIntent.processPolicies).toEqual([]);
        expect(dslIntent.globals).toEqual({});
      });
    }
  }
});

function assertFixtureBehavior(
  fixtureId: string,
  compiledConfig: Record<string, unknown>,
  verificationPlan: {
    routeChecks: Array<Record<string, unknown>>;
    dnsChecks: Array<Record<string, unknown>>;
    egressChecks: Array<Record<string, unknown>>;
    appChecks: Array<Record<string, unknown>>;
  },
): void {
  const route = compiledConfig.route as {
    rules: Array<Record<string, unknown>>;
  };
  const dns = compiledConfig.dns as {
    rules?: Array<Record<string, unknown>>;
    hosts?: Record<string, string>;
  };

  switch (fixtureId) {
    case "proxifier-vs-system-proxy":
      expect(route.rules[3]).toMatchObject({
        inbound: ["in-proxifier"],
        outbound: "Process-Proxy",
      });
      expect(
        verificationPlan.routeChecks.some(
          (check) =>
            check.id === "proxifier-antigravity" && check.expectedOutboundGroup === "Process-Proxy",
        ),
      ).toBe(true);
      expect(
        verificationPlan.appChecks.some(
          (check) =>
            check.expectedInbound === "in-proxifier" && check.expectedOutboundGroup === "US",
        ),
      ).toBe(true);
      return;

    case "google-stitch-us-only":
      expect(
        route.rules.some(
          (rule) =>
            JSON.stringify(rule.domain_suffix) === JSON.stringify(["stitch.withgoogle.com"]) &&
            rule.outbound === "Stitch-Out",
        ),
      ).toBe(true);
      expect(
        verificationPlan.egressChecks.some(
          (check) =>
            check.expectedOutboundGroup === "Stitch-Out" &&
            JSON.stringify(check.expectedCountry) === JSON.stringify(["US"]),
        ),
      ).toBe(true);
      return;

    case "cn-direct-vs-ai-sites":
      expect(route.rules[4]).toMatchObject({
        domain_suffix: ["openrouter.ai"],
        outbound: "AI-Out",
      });
      expect(
        dns.rules?.some(
          (rule) =>
            JSON.stringify(rule.rule_set) === JSON.stringify(["geosite-cn", "geoip-cn"]) &&
            rule.server === "dns-remote-cn",
        ),
      ).toBe(true);
      expect(
        verificationPlan.dnsChecks.some(
          (check) =>
            check.domain === "openrouter.ai" && check.expectedResolver === "dns-remote-primary",
        ),
      ).toBe(true);
      return;

    case "antigravity-process-route":
      expect(
        verificationPlan.appChecks.some(
          (check) =>
            String(check.app).includes("Antigravity") &&
            check.expectedInbound === "in-proxifier" &&
            check.expectedOutboundGroup === "US",
        ),
      ).toBe(true);
      expect(
        verificationPlan.routeChecks.some(
          (check) =>
            check.id === "antigravity-docs" && check.expectedOutboundGroup === "Process-Proxy",
        ),
      ).toBe(true);
      return;

    case "fake-ip-vs-real-ip":
      expect(verificationPlan.dnsChecks.every((check) => check.expectedMode === "real-ip")).toBe(
        true,
      );
      expect(dns.hosts).toMatchObject({
        "nas.adrop.top": "192.168.50.10",
      });
      return;

    case "github-openai-split-egress":
      expect(
        verificationPlan.egressChecks.some(
          (check) =>
            check.expectedOutboundGroup === "AI-Out" &&
            JSON.stringify(check.expectedCountry) === JSON.stringify(["SG"]),
        ),
      ).toBe(true);
      expect(
        verificationPlan.egressChecks.some(
          (check) =>
            check.expectedOutboundGroup === "Dev-Common-Out" &&
            JSON.stringify(check.expectedCountry) === JSON.stringify(["HK"]),
        ),
      ).toBe(true);
      return;

    default:
      throw new Error(`Unhandled regression fixture assertions for ${fixtureId}.`);
  }
}
