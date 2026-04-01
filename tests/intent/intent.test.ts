import { describe, expect, it } from "vitest";

import {
  createEmptyIntent,
  intentFromNaturalLanguagePlan,
  intentFromUserRules,
  mergeIntents,
} from "../../src/modules/intent/index.js";

describe("intent IR", () => {
  it("compiles DSL rules into site policies", () => {
    const intent = intentFromUserRules({
      beforeBuiltins: [
        {
          name: "OpenRouter uses AI",
          domainSuffix: ["openrouter.ai"],
          route: "AI-Out",
        },
      ],
      afterBuiltins: [
        {
          name: "Reject UDP test",
          network: "udp",
          port: 5353,
          action: "reject",
        },
      ],
      warnings: [],
    });

    expect(intent.version).toBe("v1");
    expect(intent.sitePolicies).toEqual([
      {
        placement: "beforeBuiltins",
        name: "OpenRouter uses AI",
        match: {
          domainSuffix: ["openrouter.ai"],
        },
        action: {
          type: "route",
          outboundGroup: "AI-Out",
        },
      },
      {
        placement: "afterBuiltins",
        name: "Reject UDP test",
        match: {
          network: "udp",
          port: 5353,
        },
        action: {
          type: "reject",
        },
      },
    ]);
  });

  it("compiles natural-language plans into intent policies and globals", () => {
    const intent = intentFromNaturalLanguagePlan({
      beforeBuiltins: [
        {
          name: "Gemini to SG",
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

    expect(intent.globals.updateIntervalMinutes).toBe(45);
    expect(intent.sitePolicies[0]).toMatchObject({
      placement: "beforeBuiltins",
      match: {
        domainSuffix: ["gemini.google.com"],
      },
      action: {
        type: "route",
        outboundGroup: "SG",
      },
    });
    expect(intent.processPolicies[0]).toMatchObject({
      inbound: "in-proxifier",
      outboundGroup: "US",
      verify: {
        expectProxyHit: true,
      },
    });
  });

  it("merges intent layers while keeping policy order", () => {
    const merged = mergeIntents([
      createEmptyIntent(),
      intentFromUserRules({
        beforeBuiltins: [{ domainSuffix: ["openrouter.ai"], route: "AI-Out" }],
        afterBuiltins: [],
        warnings: [],
      }),
      intentFromNaturalLanguagePlan({
        beforeBuiltins: [{ domainSuffix: ["gemini.google.com"], route: "SG" }],
        afterBuiltins: [],
        templateIds: [],
        notes: [],
        scheduleIntervalMinutes: 30,
        groupDefaults: {},
        verificationOverrides: [],
      }),
    ]);

    expect(merged.sitePolicies.map((policy) => policy.match.domainSuffix?.[0])).toEqual([
      "openrouter.ai",
      "gemini.google.com",
    ]);
    expect(merged.globals.updateIntervalMinutes).toBe(30);
  });
});
