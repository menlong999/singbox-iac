import { describe, expect, it } from "vitest";

import {
  collectSiteBundleDomains,
  getSiteBundle,
  selectProcessBundlesFromText,
  selectSiteBundlesFromText,
} from "../../src/modules/bundle-registry/index.js";

describe("bundle registry", () => {
  it("discovers NotebookLM as a first-class site bundle", () => {
    const selected = selectSiteBundlesFromText("NotebookLM 走美国");

    expect(selected.map((bundle) => bundle.id)).toContain("notebooklm");
    expect(collectSiteBundleDomains(selected)).toContain("notebooklm.google.com");
    expect(getSiteBundle("notebooklm")?.verificationUrls).toContain(
      "https://notebooklm.google.com/favicon.ico",
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
