import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import YAML from "yaml";

import {
  analyzePrompt,
  generateRulesFromPrompt,
  selectVerificationScenariosForPrompt,
  updateBuilderAuthoring,
} from "../../src/modules/natural-language/index.js";

describe("natural language authoring", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("turns a developer-centric prompt into rules and a schedule interval", () => {
    const plan = generateRulesFromPrompt(
      "OpenRouter 和 Perplexity 走香港 AI，YouTube Netflix 走美国，Bilibili 爱奇艺直连，每45分钟自动更新",
    );

    expect(plan.scheduleIntervalMinutes).toBe(45);
    expect(plan.beforeBuiltins.some((rule) => rule.route === "HK")).toBe(true);
    expect(plan.beforeBuiltins.some((rule) => rule.route === "US")).toBe(true);
    expect(plan.afterBuiltins.some((rule) => rule.route === "direct")).toBe(true);
  });

  it("recognizes mainstream video and platform service aliases", () => {
    const plan = generateRulesFromPrompt("Amazon Prime 和 Apple TV 走新加坡，Apple 服务走香港");

    expect(plan.beforeBuiltins.some((rule) => rule.domainSuffix?.includes("primevideo.com"))).toBe(
      true,
    );
    expect(plan.beforeBuiltins.some((rule) => rule.domainSuffix?.includes("tv.apple.com"))).toBe(
      true,
    );
    expect(plan.beforeBuiltins.some((rule) => rule.route === "SG")).toBe(true);
    expect(
      plan.beforeBuiltins.some(
        (rule) => rule.domainSuffix?.includes("apple.com") && rule.route === "HK",
      ),
    ).toBe(true);
  });

  it("maps generic developer and video phrases to reusable templates", () => {
    const plan = generateRulesFromPrompt("开发者网站走香港，AI 工具走香港，视频网站走新加坡");

    expect(plan.templateIds).toContain("developer-ai-sites");
    expect(plan.templateIds).toContain("developer-common-sites");
    expect(plan.templateIds).toContain("video-sg");
    expect(plan.beforeBuiltins.some((rule) => rule.route === "AI-Out")).toBe(true);
    expect(plan.beforeBuiltins.some((rule) => rule.route === "Dev-Common-Out")).toBe(true);
    expect(plan.beforeBuiltins.some((rule) => rule.route === "SG")).toBe(true);
    expect(plan.groupDefaults?.aiOut?.defaultTarget).toBe("HK");
    expect(plan.groupDefaults?.devCommonOut?.defaultTarget).toBe("HK");
  });

  it("supports one-sentence developer intent with process, category, and site-specific routing", () => {
    const plan = generateRulesFromPrompt(
      "GitHub 这类开发类都走香港出口，Antigravity 进程级都走独立入口并路由到美国节点，Gemini 都出口到新加坡",
    );

    expect(plan.groupDefaults?.devCommonOut?.defaultTarget).toBe("HK");
    expect(plan.groupDefaults?.processProxy?.defaultTarget).toBe("US");
    expect(plan.groupDefaults?.processProxy?.defaultNodePattern).toBe("OnlyAI");
    expect(
      plan.beforeBuiltins.some((rule) => rule.domainSuffix?.includes("gemini.google.com")),
    ).toBe(true);
    expect(plan.beforeBuiltins.some((rule) => rule.route === "SG")).toBe(true);
    expect(
      plan.notes.some((note) => note.includes("built-in proxifier bundles: Antigravity")),
    ).toBe(true);
    expect(
      plan.verificationOverrides?.some(
        (override) =>
          override.inbound === "in-mixed" &&
          override.domainSuffix === "gemini.google.com" &&
          override.expectedOutbound === "SG",
      ),
    ).toBe(true);
  });

  it("expands recognized site bundles such as NotebookLM into explicit domains and verification hints", () => {
    const plan = generateRulesFromPrompt("NotebookLM 走美国");

    expect(
      plan.beforeBuiltins.some(
        (rule) => rule.domainSuffix?.includes("notebooklm.google.com") && rule.route === "US",
      ),
    ).toBe(true);
    expect(
      plan.verificationOverrides?.some(
        (override) =>
          override.domainSuffix === "notebooklm.google.com" && override.expectedOutbound === "US",
      ),
    ).toBe(true);
  });

  it("prefers active official rule sets for recognized site bundles and keeps verification hints concrete", () => {
    const plan = generateRulesFromPrompt("ChatGPT 和 Perplexity 走香港", {
      activeRuleSetTags: ["geosite-openai", "geosite-perplexity"],
    });

    expect(
      plan.beforeBuiltins.some(
        (rule) => rule.ruleSet?.includes("geosite-openai") && rule.route === "HK",
      ),
    ).toBe(true);
    expect(
      plan.beforeBuiltins.some(
        (rule) => rule.ruleSet?.includes("geosite-perplexity") && rule.route === "HK",
      ),
    ).toBe(true);
    expect(plan.beforeBuiltins.some((rule) => rule.domainSuffix?.includes("chatgpt.com"))).toBe(
      false,
    );
    expect(
      plan.verificationOverrides?.some(
        (override) => override.domainSuffix === "chatgpt.com" && override.expectedOutbound === "HK",
      ),
    ).toBe(true);
  });

  it("records a fallback note when an official site bundle tag is known but not active locally", () => {
    const plan = generateRulesFromPrompt("ChatGPT 走香港");

    expect(plan.beforeBuiltins.some((rule) => rule.domainSuffix?.includes("chatgpt.com"))).toBe(
      true,
    );
    expect(
      plan.notes.some(
        (note) =>
          note.includes('Site bundle "ChatGPT" fell back to curated domains') &&
          note.includes("geosite-openai"),
      ),
    ).toBe(true);
  });

  it("reports ambiguity diagnostics for vague developer routing prompts", () => {
    const analysis = analyzePrompt("AI 都走好一点的节点，GitHub 大部分走香港");

    expect(analysis.ambiguities.length).toBeGreaterThan(0);
    expect(analysis.ambiguities.some((ambiguity) => ambiguity.includes("好一点的节点"))).toBe(true);
    expect(analysis.ambiguities.some((ambiguity) => ambiguity.includes("大部分"))).toBe(true);
  });

  it("keeps OnlyAI pinning available when the prompt asks for it explicitly", () => {
    const plan = generateRulesFromPrompt("Antigravity 进程级走美国 OnlyAI 节点");

    expect(plan.groupDefaults?.processProxy?.defaultTarget).toBe("US");
    expect(plan.groupDefaults?.processProxy?.defaultNodePattern).toBe("OnlyAI");
  });

  it("selects visible verification scenarios from a natural-language prompt", () => {
    const selected = selectVerificationScenariosForPrompt(
      "我需要给 proxifier 单独设置进程级的入口，出口到美国；所有 ai 类、开发工具网站类，出口到香港节点；google stitch 相关出口到美国；国内直连",
      [
        {
          id: "antigravity-auth",
          name: "Antigravity auth",
          url: "https://accounts.google.com/favicon.ico",
          inbound: "in-proxifier",
          expectedOutbound: "Process-Proxy",
        },
        {
          id: "stitch-us",
          name: "Stitch",
          url: "https://stitch.withgoogle.com/favicon.ico",
          inbound: "in-mixed",
          expectedOutbound: "Stitch-Out",
        },
        {
          id: "chatgpt-hk",
          name: "ChatGPT",
          url: "https://chatgpt.com/favicon.ico",
          inbound: "in-mixed",
          expectedOutbound: "AI-Out",
        },
        {
          id: "github-hk",
          name: "GitHub",
          url: "https://github.com/favicon.ico",
          inbound: "in-mixed",
          expectedOutbound: "Dev-Common-Out",
        },
        {
          id: "cn-direct",
          name: "China direct",
          url: "https://www.qq.com/favicon.ico",
          inbound: "in-mixed",
          expectedOutbound: "direct",
        },
      ],
    );

    expect(selected.map((scenario) => scenario.id)).toEqual([
      "antigravity-auth",
      "stitch-us",
      "chatgpt-hk",
      "github-hk",
      "cn-direct",
    ]);
  });

  it("updates builder config authoring fields in place", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-authoring-"));
    tempDirs.push(dir);

    const configPath = path.join(dir, "builder.config.yaml");
    const rulesPath = path.join(dir, "custom.rules.yaml");
    writeFileSync(
      configPath,
      `version: 1
subscription:
  url: "https://example.com/subscription"
  format: "base64-lines"
  protocols:
    - trojan
output:
  stagingPath: "${path.join(dir, "staging.json")}"
  livePath: "${path.join(dir, "live.json")}"
  backupPath: "${path.join(dir, "backup.json")}"
runtime:
  checkCommand: "sing-box check -c {{stagingPath}}"
  reload:
    kind: "signal"
    processName: "sing-box"
    signal: "HUP"
listeners:
  mixed:
    enabled: true
    listen: "127.0.0.1"
    port: 39097
  proxifier:
    enabled: true
    listen: "127.0.0.1"
    port: 39091
ruleSets: []
groups:
  processProxy:
    type: "selector"
    includes: ["US"]
  aiOut:
    type: "selector"
    includes: ["HK", "US"]
    defaultTarget: "HK"
  devCommonOut:
    type: "selector"
    includes: ["HK", "US"]
    defaultTarget: "HK"
  stitchOut:
    type: "selector"
    includes: ["US"]
    defaultTarget: "US"
  global:
    type: "urltest"
    includes: ["HK", "US"]
rules:
  userRulesFile: "/tmp/original.rules.yaml"
verification:
  scenarios:
    - id: "chatgpt-hk"
      name: "ChatGPT uses the HK default AI path"
      url: "https://chatgpt.com/favicon.ico"
      inbound: "in-mixed"
      expectedOutbound: "AI-Out"
    - id: "gemini-hk"
      name: "Gemini uses the HK default AI path"
      url: "https://gemini.google.com/favicon.ico"
      inbound: "in-mixed"
      expectedOutbound: "AI-Out"
schedule:
  enabled: false
  intervalMinutes: 30
authoring:
  provider: "deterministic"
  timeoutMs: 4000
`,
    );

    await updateBuilderAuthoring({
      configPath,
      rulesPath,
      intervalMinutes: 45,
      groupDefaults: {
        aiOut: { defaultTarget: "SG" },
        devCommonOut: { defaultTarget: "HK" },
      },
      verificationOverrides: [
        {
          domainSuffix: "gemini.google.com",
          expectedOutbound: "SG",
        },
      ],
    });

    const updated = YAML.parse(readFileSync(configPath, "utf8")) as {
      rules: { userRulesFile: string };
      schedule: { enabled: boolean; intervalMinutes: number };
      groups: {
        aiOut: { defaultTarget: string };
        devCommonOut: { defaultTarget: string };
      };
      verification: {
        scenarios: Array<{ url: string; expectedOutbound: string }>;
      };
    };
    expect(updated.rules.userRulesFile).toBe(rulesPath);
    expect(updated.schedule.enabled).toBe(true);
    expect(updated.schedule.intervalMinutes).toBe(45);
    expect(updated.groups.aiOut.defaultTarget).toBe("SG");
    expect(updated.groups.devCommonOut.defaultTarget).toBe("HK");
    expect(
      updated.verification.scenarios.find((scenario) => scenario.url.includes("chatgpt.com"))
        ?.expectedOutbound,
    ).toBe("AI-Out");
    expect(
      updated.verification.scenarios.find((scenario) => scenario.url.includes("gemini.google.com"))
        ?.expectedOutbound,
    ).toBe("SG");
  });
});
