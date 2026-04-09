import { describe, expect, it } from "vitest";

import {
  collectSiteBundleFallbackHosts,
  collectSiteBundleVerificationHosts,
  getSiteBundle,
  resolveSiteBundleMatchers,
  selectProcessBundlesFromText,
  selectSiteBundlesFromText,
} from "../../src/modules/bundle-registry/index.js";

describe("bundle registry", () => {
  it("discovers NotebookLM as a first-class site bundle", () => {
    const selected = selectSiteBundlesFromText("NotebookLM 走美国");

    expect(selected.map((bundle) => bundle.id)).toContain("notebooklm");
    expect(collectSiteBundleFallbackHosts(selected)).toContain("notebooklm.google.com");
    expect(resolveSiteBundleMatchers(selected, new Set())).toEqual([
      expect.objectContaining({
        bundleId: "notebooklm",
        domainSuffix: expect.arrayContaining(["notebooklm.google.com"]),
        usedFallback: true,
      }),
    ]);
    expect(getSiteBundle("notebooklm")?.verificationUrls).toContain(
      "https://notebooklm.google.com/favicon.ico",
    );
    expect(collectSiteBundleVerificationHosts(selected)).toContain("notebooklm.google.com");
  });

  it("prefers official active rule-set tags when a site bundle has upstream coverage", () => {
    const selected = selectSiteBundlesFromText("ChatGPT 和 Perplexity 走香港");
    const resolved = resolveSiteBundleMatchers(
      selected,
      new Set(["geosite-openai", "geosite-perplexity"]),
    );

    expect(resolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bundleId: "chatgpt",
          ruleSet: expect.arrayContaining(["geosite-openai"]),
          usedFallback: false,
        }),
        expect.objectContaining({
          bundleId: "perplexity",
          ruleSet: expect.arrayContaining(["geosite-perplexity"]),
          usedFallback: false,
        }),
      ]),
    );
  });

  it("discovers fallback-first site bundles derived from curated long-lived subscription rules", () => {
    const selected = selectSiteBundlesFromText(
      "LeetCode、TradingView、TypingMind、Roam Research、Todoist、IFTTT、Humble Bundle、Fanatical、Grindr、Behance 都走香港",
    );

    expect(selected.map((bundle) => bundle.id)).toEqual(
      expect.arrayContaining([
        "leetcode",
        "tradingview",
        "typingmind",
        "roam-research",
        "todoist",
        "ifttt",
        "humble-bundle",
        "fanatical",
        "grindr",
        "behance",
      ]),
    );
    expect(collectSiteBundleFallbackHosts(selected)).toEqual(
      expect.arrayContaining([
        "leetcode.com",
        "tradingview.com",
        "typingmind.com",
        "roamresearch.com",
        "todoist.com",
        "ifttt.com",
        "ift.tt",
        "humblebundle.com",
        "fanatical.com",
        "grindr.com",
        "grindr.mobi",
        "behance.net",
      ]),
    );
  });

  it("discovers process bundles without confusing site products for CLI tools", () => {
    expect(
      selectProcessBundlesFromText("Antigravity 进程级走美国").map((bundle) => bundle.id),
    ).toEqual(expect.arrayContaining(["antigravity", "developer-ai-cli"]));
    expect(selectProcessBundlesFromText("Gemini 走新加坡")).toEqual([]);
    expect(selectProcessBundlesFromText("Codex 走独立入口").map((bundle) => bundle.id)).toContain(
      "codex",
    );
  });
});
