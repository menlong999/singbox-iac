import { existsSync } from "node:fs";

import type { BuilderConfig } from "../../config/schema.js";
import type { BuildArtifact } from "../../domain/config.js";
import type { NormalizedNode } from "../../domain/node.js";
import type { TrojanOutbound } from "../../domain/outbound.js";
import type { LoadedUserRules, UserRouteRule } from "../user-rules/index.js";

export interface CompileConfigInput {
  readonly nodes: NormalizedNode[];
  readonly config: BuilderConfig;
  readonly userRules?: LoadedUserRules;
}

const urlTestDefaults = {
  interval: "10m",
  url: "https://www.gstatic.com/generate_204",
};

type ConfigObject = Record<string, unknown>;
type ConfigOutbound = TrojanOutbound | ConfigObject;

interface RegionGroup {
  readonly tag: string;
  readonly leafTags: readonly string[];
  readonly outbound: ConfigObject;
}

const aiRuleSetTags = new Set([
  "geosite-google-gemini",
  "geosite-google-deepmind",
  "geosite-anthropic",
]);

const devCommonRuleSetTags = new Set([
  "geosite-google",
  "geosite-github",
  "geosite-github-copilot",
  "geosite-cursor",
  "geosite-figma",
]);

const defaultDnsServerTag = "dns-remote-primary";

export function compileConfig(input: CompileConfigInput): BuildArtifact {
  if (input.nodes.length === 0) {
    throw new Error("Cannot compile config without at least one parsed node.");
  }

  const warnings: string[] = [];
  const nodeOutbounds = input.nodes.map(toTrojanOutbound);
  const regionGroups = buildRegionGroups(input.nodes);
  const regionGroupOutbounds = regionGroups.map((group) => group.outbound);
  const proxyTags = nodeOutbounds.map((outbound) => outbound.tag);
  const availableRuleSets = input.config.ruleSets.filter((ruleSet) => {
    const exists = ruleSet.path.length > 0 && existsSync(ruleSet.path);
    if (!exists) {
      warnings.push(`Rule set "${ruleSet.tag}" was configured but not found at ${ruleSet.path}.`);
    }
    return exists;
  });

  const outbounds: ConfigOutbound[] = [
    ...nodeOutbounds,
    ...regionGroupOutbounds,
    buildPolicyGroup(
      "Global",
      input.config.groups.global.type,
      resolveOutboundTargets(input.config.groups.global.includes, regionGroups, proxyTags),
    ),
    buildConfiguredSelectorGroup(
      "Process-Proxy",
      input.config.groups.processProxy,
      regionGroups,
      proxyTags,
      "Global",
      warnings,
    ),
    buildConfiguredSelectorGroup(
      "AI-Out",
      input.config.groups.aiOut,
      regionGroups,
      proxyTags,
      "Global",
      warnings,
    ),
    buildConfiguredSelectorGroup(
      "Dev-Common-Out",
      input.config.groups.devCommonOut,
      regionGroups,
      proxyTags,
      "Global",
      warnings,
    ),
    buildConfiguredSelectorGroup(
      "Stitch-Out",
      input.config.groups.stitchOut,
      regionGroups,
      proxyTags,
      "Global",
      warnings,
    ),
    { type: "direct", tag: "direct" },
    { type: "block", tag: "block" },
  ];
  const availableOutboundTags = new Set(
    outbounds
      .map((outbound) => (typeof outbound.tag === "string" ? outbound.tag : undefined))
      .filter((tag): tag is string => typeof tag === "string"),
  );
  const activeRuleSetTags = new Set(availableRuleSets.map((ruleSet) => ruleSet.tag));

  if (regionGroupOutbounds.length === 0) {
    warnings.push(
      "No region groups were inferred from node tags; policy groups fell back to raw node tags.",
    );
  }

  const protectedRules: Array<Record<string, unknown>> = [
    { action: "sniff" },
    { network: "udp", port: 443, action: "reject" },
    { protocol: "dns", action: "hijack-dns" },
    { inbound: ["in-proxifier"], action: "route", outbound: "Process-Proxy" },
  ];
  const builtInServiceRules: Array<Record<string, unknown>> = [
    {
      domain_suffix: ["stitch.withgoogle.com"],
      action: "route",
      outbound: "Stitch-Out",
    },
    {
      domain_suffix: ["openai.com", "chatgpt.com"],
      action: "route",
      outbound: "AI-Out",
    },
  ];
  const beforeBuiltins = compileUserRouteRules(
    input.userRules?.beforeBuiltins ?? [],
    availableOutboundTags,
    activeRuleSetTags,
  );

  const activeAiRuleSetTags = availableRuleSets
    .filter((ruleSet) => aiRuleSetTags.has(ruleSet.tag))
    .map((ruleSet) => ruleSet.tag);
  if (activeAiRuleSetTags.length > 0) {
    builtInServiceRules.push({
      rule_set: activeAiRuleSetTags,
      action: "route",
      outbound: "AI-Out",
    });
  }

  const activeDevCommonRuleSetTags = availableRuleSets
    .filter((ruleSet) => devCommonRuleSetTags.has(ruleSet.tag))
    .map((ruleSet) => ruleSet.tag);
  if (activeDevCommonRuleSetTags.length > 0) {
    builtInServiceRules.push({
      rule_set: activeDevCommonRuleSetTags,
      action: "route",
      outbound: "Dev-Common-Out",
    });
  }

  const afterBuiltins = compileUserRouteRules(
    input.userRules?.afterBuiltins ?? [],
    availableOutboundTags,
    activeRuleSetTags,
  );
  const tailRules: Array<Record<string, unknown>> = [];
  const chinaRuleSetTags = availableRuleSets
    .filter((ruleSet) => ruleSet.tag === "geosite-cn" || ruleSet.tag === "geoip-cn")
    .map((ruleSet) => ruleSet.tag);
  if (chinaRuleSetTags.length > 0) {
    tailRules.push({ rule_set: chinaRuleSetTags, action: "route", outbound: "direct" });
  }
  const rules: Array<Record<string, unknown>> = [
    ...protectedRules,
    ...beforeBuiltins,
    ...builtInServiceRules,
    ...afterBuiltins,
    ...tailRules,
  ];

  const route: ConfigObject = {
    rules,
    final: "Global",
    auto_detect_interface: true,
    default_domain_resolver: defaultDnsServerTag,
  };

  if (availableRuleSets.length > 0) {
    route.rule_set = availableRuleSets;
  }

  const config: Record<string, unknown> = {
    log: { level: "info" },
    dns: {
      servers: [
        {
          type: "udp",
          tag: defaultDnsServerTag,
          server: "1.1.1.1",
          server_port: 53,
        },
        {
          type: "udp",
          tag: "dns-remote-cn",
          server: "223.5.5.5",
          server_port: 53,
        },
      ],
      final: defaultDnsServerTag,
      strategy: "prefer_ipv4",
    },
    inbounds: [
      {
        type: "mixed",
        tag: "in-mixed",
        listen: input.config.listeners.mixed.listen,
        listen_port: input.config.listeners.mixed.port,
      },
      {
        type: "mixed",
        tag: "in-proxifier",
        listen: input.config.listeners.proxifier.listen,
        listen_port: input.config.listeners.proxifier.port,
      },
    ],
    outbounds,
    route,
  };

  return { config, warnings };
}

function compileUserRouteRules(
  rules: readonly UserRouteRule[],
  availableOutboundTags: ReadonlySet<string>,
  activeRuleSetTags: ReadonlySet<string>,
): Array<Record<string, unknown>> {
  return rules.map((rule, index) =>
    compileUserRouteRule(rule, index, availableOutboundTags, activeRuleSetTags),
  );
}

function compileUserRouteRule(
  rule: UserRouteRule,
  index: number,
  availableOutboundTags: ReadonlySet<string>,
  activeRuleSetTags: ReadonlySet<string>,
): Record<string, unknown> {
  const compiled: Record<string, unknown> = {};
  const name = rule.name ?? `user rule #${index + 1}`;

  if (rule.inbound) {
    compiled.inbound = [...rule.inbound];
  }
  if (rule.protocol) {
    compiled.protocol = rule.protocol;
  }
  if (rule.network) {
    compiled.network = rule.network;
  }
  if (rule.port) {
    compiled.port = rule.port;
  }
  if (rule.domain) {
    compiled.domain = [...rule.domain];
  }
  if (rule.domainSuffix) {
    compiled.domain_suffix = [...rule.domainSuffix];
  }
  if (rule.ruleSet) {
    const missingRuleSets = rule.ruleSet.filter((tag) => !activeRuleSetTags.has(tag));
    if (missingRuleSets.length > 0) {
      throw new Error(
        `Custom rule "${name}" references missing rule set tags: ${missingRuleSets.join(", ")}.`,
      );
    }
    compiled.rule_set = [...rule.ruleSet];
  }

  if (rule.route) {
    if (!availableOutboundTags.has(rule.route)) {
      throw new Error(`Custom rule "${name}" references unknown outbound "${rule.route}".`);
    }
    compiled.action = "route";
    compiled.outbound = rule.route;
    return compiled;
  }

  if (rule.action === "reject") {
    compiled.action = "reject";
    return compiled;
  }

  throw new Error(`Custom rule "${name}" did not resolve to a supported sing-box action.`);
}

function toTrojanOutbound(node: NormalizedNode): TrojanOutbound {
  const tls: TrojanOutbound["tls"] = {
    enabled: true,
    ...(node.sni ? { server_name: node.sni } : {}),
    ...(node.insecure !== undefined ? { insecure: node.insecure } : {}),
  };

  return {
    type: "trojan",
    tag: node.tag,
    server: node.server,
    server_port: node.serverPort,
    password: node.password,
    tls,
  };
}

function buildRegionGroups(nodes: NormalizedNode[]): RegionGroup[] {
  const grouped = new Map<string, string[]>();

  for (const node of nodes) {
    const region = node.regionHint;
    if (!region) {
      continue;
    }
    const tags = grouped.get(region) ?? [];
    tags.push(node.tag);
    grouped.set(region, tags);
  }

  return [...grouped.entries()].map(([region, tags]) => ({
    tag: region,
    leafTags: tags,
    outbound: buildSelectorGroup(region, [...tags, "direct"]),
  }));
}

function resolveOutboundTargets(
  preferredRegions: readonly string[],
  regionGroups: readonly RegionGroup[],
  fallbackNodeTags: readonly string[],
): string[] {
  const availableRegionTags = new Set(regionGroups.map((group) => group.tag));
  const resolved = preferredRegions.filter((tag) => availableRegionTags.has(tag));
  return resolved.length > 0 ? resolved : [...fallbackNodeTags];
}

function buildConfiguredSelectorGroup(
  tag: string,
  groupConfig: BuilderConfig["groups"]["processProxy"],
  regionGroups: readonly RegionGroup[],
  fallbackNodeTags: readonly string[],
  fallbackTag: string,
  warnings: string[],
): ConfigObject {
  const regionMap = new Map(regionGroups.map((group) => [group.tag, group] as const));
  const resolvedRegionTargets = groupConfig.includes.filter((region) => regionMap.has(region));
  const selectorTargets = dedupeStrings(
    resolvedRegionTargets.length > 0
      ? [...resolvedRegionTargets, fallbackTag, "direct"]
      : [fallbackTag, "direct"],
  );
  const candidateLeafTags =
    resolvedRegionTargets.length > 0
      ? resolvedRegionTargets.flatMap((region) => regionMap.get(region)?.leafTags ?? [])
      : [...fallbackNodeTags];

  const explicitDefault = resolveConfiguredDefaultTarget(
    tag,
    groupConfig,
    selectorTargets,
    candidateLeafTags,
    warnings,
  );
  const outbounds = explicitDefault
    ? dedupeStrings([explicitDefault, ...selectorTargets])
    : selectorTargets;

  return buildSelectorGroup(tag, outbounds, explicitDefault);
}

function resolveConfiguredDefaultTarget(
  groupTag: string,
  groupConfig: BuilderConfig["groups"]["processProxy"],
  selectorTargets: readonly string[],
  candidateLeafTags: readonly string[],
  warnings: string[],
): string | undefined {
  if (groupConfig.defaultTarget) {
    if (
      selectorTargets.includes(groupConfig.defaultTarget) ||
      candidateLeafTags.includes(groupConfig.defaultTarget)
    ) {
      return groupConfig.defaultTarget;
    }

    warnings.push(
      `Group "${groupTag}" requested defaultTarget "${groupConfig.defaultTarget}" but it was not available in resolved targets.`,
    );
  }

  if (groupConfig.defaultNodePattern) {
    const { defaultNodePattern } = groupConfig;
    const regex = compileCaseInsensitivePattern(defaultNodePattern, warnings, groupTag);
    const matched = regex
      ? candidateLeafTags.find((candidate) => regex.test(candidate))
      : candidateLeafTags.find((candidate) =>
          candidate.toLowerCase().includes(defaultNodePattern.toLowerCase()),
        );

    if (matched) {
      return matched;
    }

    warnings.push(
      `Group "${groupTag}" requested defaultNodePattern "${defaultNodePattern}" but no matching node tag was found.`,
    );
  }

  return selectorTargets[0];
}

function compileCaseInsensitivePattern(
  pattern: string,
  warnings: string[],
  groupTag: string,
): RegExp | undefined {
  try {
    return new RegExp(pattern, "i");
  } catch {
    warnings.push(
      `Group "${groupTag}" defaultNodePattern "${pattern}" is not a valid regular expression. Falling back to substring matching.`,
    );
    return undefined;
  }
}

function buildSelectorGroup(
  tag: string,
  outbounds: readonly string[],
  defaultTarget?: string,
): Record<string, unknown> {
  const uniqueOutbounds = dedupeStrings(outbounds);
  return {
    type: "selector",
    tag,
    outbounds: uniqueOutbounds,
    default:
      defaultTarget && uniqueOutbounds.includes(defaultTarget) ? defaultTarget : uniqueOutbounds[0],
  };
}

function buildPolicyGroup(
  tag: string,
  type: "selector" | "urltest",
  outbounds: readonly string[],
): Record<string, unknown> {
  if (type === "urltest") {
    return {
      type: "urltest",
      tag,
      outbounds: dedupeStrings(outbounds),
      ...urlTestDefaults,
    };
  }

  return buildSelectorGroup(tag, dedupeStrings([...outbounds, "direct"]));
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}
