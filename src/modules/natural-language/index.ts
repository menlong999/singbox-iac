import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import type { BuilderConfig } from "../../config/schema.js";
import { mergeRuleTemplates } from "../rule-templates/index.js";
import type { UserRouteRule } from "../user-rules/index.js";

export interface NaturalLanguageGroupOverride {
  readonly defaultTarget?: string;
  readonly defaultNodePattern?: string;
}

export interface NaturalLanguageVerificationOverride {
  readonly inbound?: "in-mixed" | "in-proxifier";
  readonly domain?: string;
  readonly domainSuffix?: string;
  readonly expectedOutbound: string;
}

export interface NaturalLanguagePlan {
  readonly beforeBuiltins: readonly UserRouteRule[];
  readonly afterBuiltins: readonly UserRouteRule[];
  readonly templateIds: readonly string[];
  readonly notes: readonly string[];
  readonly scheduleIntervalMinutes?: number;
  readonly groupDefaults?: Partial<{
    processProxy: NaturalLanguageGroupOverride;
    aiOut: NaturalLanguageGroupOverride;
    devCommonOut: NaturalLanguageGroupOverride;
    stitchOut: NaturalLanguageGroupOverride;
  }>;
  readonly verificationOverrides?: readonly NaturalLanguageVerificationOverride[];
}

const siteAliasDefinitions = [
  { aliases: ["openrouter"], domains: ["openrouter.ai"] },
  { aliases: ["perplexity"], domains: ["perplexity.ai"] },
  { aliases: ["chatgpt"], domains: ["chatgpt.com", "openai.com"] },
  { aliases: ["openai"], domains: ["openai.com"] },
  { aliases: ["gemini"], domains: ["gemini.google.com"] },
  { aliases: ["anthropic", "claude"], domains: ["anthropic.com", "claude.ai"] },
  { aliases: ["github"], domains: ["github.com", "githubusercontent.com"] },
  {
    aliases: ["google", "google 服务", "google services"],
    domains: ["google.com", "googleapis.com", "gstatic.com", "googlevideo.com"],
  },
  {
    aliases: ["apple", "icloud", "apple 服务", "apple services"],
    domains: ["apple.com", "icloud.com", "mzstatic.com", "tv.apple.com"],
  },
  { aliases: ["google stitch", "stitch"], domains: ["stitch.withgoogle.com"] },
  { aliases: ["google tv"], domains: ["tv.youtube.com"] },
  { aliases: ["youtube"], domains: ["youtube.com", "youtu.be"] },
  { aliases: ["netflix"], domains: ["netflix.com", "nflxvideo.net"] },
  {
    aliases: ["amazon prime", "prime video", "primevideo", "amazon video"],
    domains: ["primevideo.com", "amazonvideo.com"],
  },
  {
    aliases: ["disney+", "disney plus", "disneyplus"],
    domains: ["disneyplus.com", "disney-plus.net"],
  },
  { aliases: ["bilibili", "b站"], domains: ["bilibili.com", "bilibili.tv"] },
  { aliases: ["iqiyi", "爱奇艺"], domains: ["iqiyi.com", "iq.com"] },
  { aliases: ["youku", "优酷"], domains: ["youku.com"] },
  { aliases: ["mgtv", "芒果tv", "芒果"], domains: ["mgtv.com"] },
];

const categoryTemplateDefinitions = [
  {
    aliases: [
      "ai工具",
      "ai 工具",
      "ai tools",
      "third-party ai",
      "developer ai",
      "第三方ai",
      "第三方 ai",
    ],
    templateId: "developer-ai-sites",
  },
  {
    aliases: ["开发者网站", "开发工具网站", "developer sites", "developer tools", "dev sites"],
    templateId: "developer-common-sites",
  },
  {
    aliases: ["开发类", "开发相关", "技术网站"],
    templateId: "developer-common-sites",
  },
  {
    aliases: [
      "视频网站",
      "video sites",
      "streaming",
      "google tv",
      "netflix",
      "amazon prime",
      "prime video",
      "disney+",
      "apple tv",
    ],
    templateId: "video-us",
  },
  { aliases: ["日本视频网站", "jp video"], templateId: "video-jp" },
  { aliases: ["国内视频网站", "cn video"], templateId: "cn-video-direct" },
];

const processAliasDefinitions = [
  "proxifier",
  "进程级",
  "独立入口",
  "独立的入口",
  "process-level",
  "process level",
  "ide",
  "antigravity",
  "google antigravity",
];

export function generateRulesFromPrompt(prompt: string): NaturalLanguagePlan {
  const text = normalizePrompt(prompt);
  const clauses = splitClauses(text);
  const templateIds = new Set<string>();
  const beforeBuiltins: UserRouteRule[] = [];
  const afterBuiltins: UserRouteRule[] = [];
  const notes: string[] = [];
  const verificationOverrides: NaturalLanguageVerificationOverride[] = [];
  const groupDefaults: NonNullable<NaturalLanguagePlan["groupDefaults"]> = {};

  const parsedInterval = parseScheduleIntervalMinutes(text);

  for (const clause of clauses) {
    const route = extractRouteTarget(clause);
    const phase = route === "direct" ? "afterBuiltins" : "beforeBuiltins";
    const hasProcessIntent = processAliasDefinitions.some((alias) => clause.includes(alias));
    const hasAiCategory = hasTemplateAlias(clause, "developer-ai-sites");
    const hasDeveloperCategory = hasTemplateAlias(clause, "developer-common-sites");
    const hasStitchIntent = ["google stitch", "stitch"].some((alias) => clause.includes(alias));

    for (const { aliases, templateId } of categoryTemplateDefinitions) {
      if (aliases.some((alias) => clause.includes(alias))) {
        templateIds.add(resolveTemplateForRoute(templateId, route));
      }
    }

    if (route && isRegionTarget(route)) {
      if (hasAiCategory) {
        groupDefaults.aiOut = {
          ...groupDefaults.aiOut,
          defaultTarget: route,
        };
      }
      if (hasDeveloperCategory) {
        groupDefaults.devCommonOut = {
          ...groupDefaults.devCommonOut,
          defaultTarget: route,
        };
      }
      if (hasStitchIntent) {
        groupDefaults.stitchOut = {
          ...groupDefaults.stitchOut,
          defaultTarget: route,
        };
      }
      if (hasProcessIntent) {
        groupDefaults.processProxy = {
          ...groupDefaults.processProxy,
          defaultTarget: route,
          ...(clause.includes("onlyai") || clause.includes("美国") || clause.includes("us")
            ? { defaultNodePattern: "OnlyAI" }
            : {}),
        };
      }
    }

    const matchedDomains = new Set<string>();
    for (const definition of siteAliasDefinitions) {
      if (definition.aliases.some((alias) => clause.includes(alias))) {
        for (const domain of definition.domains) {
          matchedDomains.add(domain);
        }
      }
    }

    for (const domain of extractExplicitDomains(clause)) {
      matchedDomains.add(domain);
    }

    if (matchedDomains.size > 0 && route && !hasStitchIntent) {
      const rule: UserRouteRule = {
        name: `Generated from prompt: ${Array.from(matchedDomains).join(", ")}`,
        domainSuffix: [...matchedDomains],
        route,
      };
      if (phase === "beforeBuiltins") {
        beforeBuiltins.push(rule);
      } else {
        afterBuiltins.push(rule);
      }

      verificationOverrides.push(
        ...[...matchedDomains].map((domain) => ({
          inbound: "in-mixed" as const,
          domainSuffix: domain,
          expectedOutbound: route,
        })),
      );
      continue;
    }

    if (hasProcessIntent) {
      notes.push(
        `Prompt clause "${clause}" maps to the built-in proxifier flow. Use Proxifier to send the target apps to in-proxifier.`,
      );
    }
  }

  const mergedTemplates = mergeRuleTemplates([...templateIds]);

  return {
    beforeBuiltins: dedupeRules([...mergedTemplates.beforeBuiltins, ...beforeBuiltins]),
    afterBuiltins: dedupeRules([...mergedTemplates.afterBuiltins, ...afterBuiltins]),
    templateIds: [...templateIds],
    notes,
    ...(parsedInterval ? { scheduleIntervalMinutes: parsedInterval } : {}),
    ...(Object.keys(groupDefaults).length > 0 ? { groupDefaults } : {}),
    ...(verificationOverrides.length > 0 ? { verificationOverrides } : {}),
  };
}

export async function writeGeneratedRules(input: {
  readonly filePath: string;
  readonly plan: NaturalLanguagePlan;
}): Promise<string> {
  const rendered = renderGeneratedRules(input.plan);
  await mkdir(path.dirname(input.filePath), { recursive: true });
  await writeFile(input.filePath, rendered, "utf8");
  return input.filePath;
}

export function renderGeneratedRules(plan: NaturalLanguagePlan): string {
  const document = {
    version: 1,
    beforeBuiltins: plan.beforeBuiltins.map(serializeRule),
    afterBuiltins: plan.afterBuiltins.map(serializeRule),
  };

  return YAML.stringify(document);
}

export async function updateBuilderSchedule(input: {
  readonly configPath: string;
  readonly intervalMinutes: number;
}): Promise<void> {
  const raw = await readFile(input.configPath, "utf8");
  const document = YAML.parseDocument(raw);
  updateScheduleNode(document, input.intervalMinutes);
  await writeFile(input.configPath, document.toString(), "utf8");
}

export async function updateBuilderAuthoring(input: {
  readonly configPath: string;
  readonly rulesPath?: string;
  readonly subscriptionUrl?: string;
  readonly intervalMinutes?: number;
  readonly groupDefaults?: NaturalLanguagePlan["groupDefaults"];
  readonly verificationOverrides?: NaturalLanguagePlan["verificationOverrides"];
}): Promise<void> {
  const raw = await readFile(input.configPath, "utf8");
  const rendered = renderUpdatedBuilderConfig({
    rawConfig: raw,
    ...(input.rulesPath ? { rulesPath: input.rulesPath } : {}),
    ...(input.subscriptionUrl ? { subscriptionUrl: input.subscriptionUrl } : {}),
    ...(input.intervalMinutes ? { intervalMinutes: input.intervalMinutes } : {}),
    ...(input.groupDefaults ? { groupDefaults: input.groupDefaults } : {}),
    ...(input.verificationOverrides ? { verificationOverrides: input.verificationOverrides } : {}),
  });
  await writeFile(input.configPath, rendered, "utf8");
}

export function renderUpdatedBuilderConfig(input: {
  readonly rawConfig: string;
  readonly rulesPath?: string;
  readonly subscriptionUrl?: string;
  readonly intervalMinutes?: number;
  readonly groupDefaults?: NaturalLanguagePlan["groupDefaults"];
  readonly verificationOverrides?: NaturalLanguagePlan["verificationOverrides"];
}): string {
  const parsed = YAML.parse(input.rawConfig) as BuilderConfig & Record<string, unknown>;

  if (input.rulesPath) {
    parsed.rules = {
      ...parsed.rules,
      userRulesFile: input.rulesPath,
    };
  }

  if (input.subscriptionUrl) {
    parsed.subscription = {
      ...parsed.subscription,
      url: input.subscriptionUrl,
    };
  }

  if (input.intervalMinutes) {
    parsed.schedule = {
      ...parsed.schedule,
      enabled: true,
      intervalMinutes: input.intervalMinutes,
    };
  }

  if (input.groupDefaults) {
    parsed.groups = applyGroupDefaults(parsed.groups, input.groupDefaults);
  }

  if (input.verificationOverrides && input.verificationOverrides.length > 0) {
    parsed.verification = {
      ...parsed.verification,
      scenarios: applyVerificationOverrides(
        parsed.verification.scenarios,
        input.verificationOverrides,
      ),
    };
  }

  return YAML.stringify(parsed);
}

export function applyPlanToBuilderConfig(
  config: BuilderConfig,
  input: {
    readonly rulesPath: string;
    readonly plan: NaturalLanguagePlan;
  },
): BuilderConfig {
  return {
    ...config,
    rules: {
      ...config.rules,
      userRulesFile: input.rulesPath,
    },
    ...(input.plan.scheduleIntervalMinutes
      ? {
          schedule: {
            ...config.schedule,
            enabled: true,
            intervalMinutes: input.plan.scheduleIntervalMinutes,
          },
        }
      : {}),
    ...(input.plan.groupDefaults
      ? {
          groups: applyGroupDefaults(config.groups, input.plan.groupDefaults),
        }
      : {}),
    ...(input.plan.verificationOverrides && input.plan.verificationOverrides.length > 0
      ? {
          verification: {
            ...config.verification,
            scenarios: applyVerificationOverrides(
              config.verification.scenarios,
              input.plan.verificationOverrides,
            ),
          },
        }
      : {}),
  };
}

function serializeRule(rule: UserRouteRule): Record<string, unknown> {
  return {
    ...(rule.name ? { name: rule.name } : {}),
    ...(rule.inbound ? { inbound: simplifyArray(rule.inbound) } : {}),
    ...(rule.protocol ? { protocol: rule.protocol } : {}),
    ...(rule.network ? { network: rule.network } : {}),
    ...(rule.port ? { port: rule.port } : {}),
    ...(rule.domain ? { domain: simplifyArray(rule.domain) } : {}),
    ...(rule.domainSuffix ? { domainSuffix: simplifyArray(rule.domainSuffix) } : {}),
    ...(rule.ruleSet ? { ruleSet: simplifyArray(rule.ruleSet) } : {}),
    ...(rule.route ? { route: rule.route } : {}),
    ...(rule.action ? { action: rule.action } : {}),
  };
}

function simplifyArray(values: readonly string[]): string | readonly string[] {
  return values.length === 1 ? (values[0] ?? "") : values;
}

function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase();
}

function splitClauses(prompt: string): string[] {
  return prompt
    .split(/[，。,；;!！\n]/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

function parseScheduleIntervalMinutes(prompt: string): number | undefined {
  const minuteMatch = prompt.match(/每\s*(\d+)\s*分钟|every\s*(\d+)\s*minutes?/i);
  if (minuteMatch) {
    const value = Number.parseInt(minuteMatch[1] ?? minuteMatch[2] ?? "", 10);
    if (Number.isInteger(value) && value > 0) {
      return value;
    }
  }

  const hourMatch = prompt.match(/每\s*(\d+)\s*小时|every\s*(\d+)\s*hours?/i);
  if (hourMatch) {
    const value = Number.parseInt(hourMatch[1] ?? hourMatch[2] ?? "", 10);
    if (Number.isInteger(value) && value > 0) {
      return value * 60;
    }
  }

  if (prompt.includes("定时") || prompt.includes("schedule") || prompt.includes("launchd")) {
    return 30;
  }

  return undefined;
}

function extractRouteTarget(clause: string): string | undefined {
  if (clause.includes("直连") || clause.includes("direct")) {
    return "direct";
  }
  if (clause.includes("ai-out") || clause.includes("ai 组") || clause.includes("ai组")) {
    return "AI-Out";
  }
  if (clause.includes("dev-common-out") || clause.includes("开发组")) {
    return "Dev-Common-Out";
  }
  if (clause.includes("stitch-out")) {
    return "Stitch-Out";
  }
  if (clause.includes("美国") || /\bus\b/.test(clause)) {
    return "US";
  }
  if (clause.includes("香港") || /\bhk\b/.test(clause)) {
    return "HK";
  }
  if (clause.includes("新加坡") || /\bsg\b/.test(clause)) {
    return "SG";
  }
  if (clause.includes("日本") || /\bjp\b/.test(clause)) {
    return "JP";
  }

  return undefined;
}

function isRegionTarget(route: string): route is "US" | "HK" | "SG" | "JP" {
  return route === "US" || route === "HK" || route === "SG" || route === "JP";
}

function extractExplicitDomains(clause: string): string[] {
  const matches = clause.match(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/g) ?? [];
  return [...new Set(matches)];
}

function resolveTemplateForRoute(templateId: string, route: string | undefined): string {
  if (templateId === "video-us" && route === "JP") {
    return "video-jp";
  }
  if (templateId === "video-us" && route === "HK") {
    return "video-hk";
  }
  if (templateId === "video-us" && route === "SG") {
    return "video-sg";
  }
  if (templateId === "video-us" && route === "direct") {
    return "cn-video-direct";
  }
  return templateId;
}

function dedupeRules(rules: readonly UserRouteRule[]): readonly UserRouteRule[] {
  const byKey = new Map<string, UserRouteRule>();
  for (const rule of rules) {
    byKey.set(JSON.stringify(rule), rule);
  }
  return [...byKey.values()];
}

function hasTemplateAlias(clause: string, templateId: string): boolean {
  return categoryTemplateDefinitions
    .filter((definition) => definition.templateId === templateId)
    .some((definition) => definition.aliases.some((alias) => clause.includes(alias)));
}

function applyGroupDefaults(
  groups: BuilderConfig["groups"],
  overrides: NonNullable<NaturalLanguagePlan["groupDefaults"]>,
): BuilderConfig["groups"] {
  return {
    ...groups,
    ...(overrides.processProxy
      ? {
          processProxy: {
            ...groups.processProxy,
            ...overrides.processProxy,
          },
        }
      : {}),
    ...(overrides.aiOut
      ? {
          aiOut: {
            ...groups.aiOut,
            ...overrides.aiOut,
          },
        }
      : {}),
    ...(overrides.devCommonOut
      ? {
          devCommonOut: {
            ...groups.devCommonOut,
            ...overrides.devCommonOut,
          },
        }
      : {}),
    ...(overrides.stitchOut
      ? {
          stitchOut: {
            ...groups.stitchOut,
            ...overrides.stitchOut,
          },
        }
      : {}),
  };
}

function applyVerificationOverrides(
  scenarios: BuilderConfig["verification"]["scenarios"],
  overrides: readonly NaturalLanguageVerificationOverride[],
): BuilderConfig["verification"]["scenarios"] {
  return scenarios.map((scenario) => {
    const host = new URL(scenario.url).hostname.toLowerCase();
    const matchedOverride = overrides.find((override) => {
      if (override.inbound && override.inbound !== scenario.inbound) {
        return false;
      }
      if (override.domain && override.domain.toLowerCase() === host) {
        return true;
      }
      if (override.domainSuffix) {
        const suffix = override.domainSuffix.toLowerCase();
        return host === suffix || host.endsWith(`.${suffix}`);
      }
      return false;
    });

    if (!matchedOverride) {
      return scenario;
    }

    return {
      ...scenario,
      expectedOutbound: matchedOverride.expectedOutbound,
    };
  });
}

function updateScheduleNode(document: YAML.Document, intervalMinutes: number): void {
  const schedule = document.get("schedule", true);
  if (hasYamlSet(schedule)) {
    schedule.set("enabled", true);
    schedule.set("intervalMinutes", intervalMinutes);
    return;
  }

  document.set("schedule", {
    enabled: true,
    intervalMinutes,
  });
}

function hasYamlSet(value: unknown): value is { set: (key: string, nextValue: unknown) => void } {
  return (
    value !== null &&
    typeof value === "object" &&
    "set" in value &&
    typeof (value as { set?: unknown }).set === "function"
  );
}
