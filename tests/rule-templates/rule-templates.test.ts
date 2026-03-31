import { describe, expect, it } from "vitest";

import { getRuleTemplate, mergeRuleTemplates } from "../../src/modules/rule-templates/index.js";

describe("rule templates", () => {
  it("provides region-specific video templates", () => {
    expect(getRuleTemplate("video-hk")?.beforeBuiltins[0]?.route).toBe("HK");
    expect(getRuleTemplate("video-sg")?.beforeBuiltins[0]?.route).toBe("SG");
    expect(getRuleTemplate("video-jp")?.beforeBuiltins[0]?.route).toBe("JP");
    expect(
      getRuleTemplate("video-us")?.beforeBuiltins[0]?.domainSuffix?.includes("primevideo.com"),
    ).toBe(true);
    expect(
      getRuleTemplate("video-us")?.beforeBuiltins[0]?.domainSuffix?.includes("tv.apple.com"),
    ).toBe(true);
  });

  it("merges developer templates without duplicating rules", () => {
    const merged = mergeRuleTemplates(["developer-ai-sites", "developer-common-sites"]);

    expect(merged.beforeBuiltins.some((rule) => rule.route === "AI-Out")).toBe(true);
    expect(merged.beforeBuiltins.some((rule) => rule.route === "Dev-Common-Out")).toBe(true);
  });
});
