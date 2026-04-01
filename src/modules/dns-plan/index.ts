import type { BuilderConfig } from "../../config/schema.js";
import type { DNSPlan, DnsPlanRule, DnsPlanServer } from "../../domain/dns-plan.js";
import type { IntentIR } from "../../domain/intent.js";

const defaultLocalServerTag = "dns-local-default";
const defaultProxyServerTag = "dns-remote-primary";
const defaultDirectServerTag = "dns-remote-cn";

export function buildDnsPlan(input: {
  readonly config: BuilderConfig;
  readonly intent: IntentIR;
  readonly activeRuleSetTags: readonly string[];
}): DNSPlan {
  const servers: DnsPlanServer[] = [
    {
      type: "local",
      tag: defaultLocalServerTag,
      preferGo: true,
    },
    {
      type: "tcp",
      tag: defaultProxyServerTag,
      server: "1.1.1.1",
      serverPort: 53,
    },
    {
      type: "tcp",
      tag: defaultDirectServerTag,
      server: "223.5.5.5",
      serverPort: 53,
    },
  ];

  const nameserverPolicy: DnsPlanRule[] = [];
  const activeRuleSetTags = new Set(input.activeRuleSetTags);

  if (activeRuleSetTags.has("geosite-cn") || activeRuleSetTags.has("geoip-cn")) {
    nameserverPolicy.push({
      match: {
        ruleSet: [...["geosite-cn", "geoip-cn"].filter((tag) => activeRuleSetTags.has(tag))],
      },
      resolvers: [defaultDirectServerTag],
    });
  }

  for (const policy of input.intent.sitePolicies) {
    const hasDnsRelevantMatch =
      policy.match.domain || policy.match.domainSuffix || policy.match.ruleSet;

    if (!hasDnsRelevantMatch) {
      continue;
    }

    nameserverPolicy.push({
      match: {
        ...(policy.match.domain ? { domain: policy.match.domain } : {}),
        ...(policy.match.domainSuffix ? { domainSuffix: policy.match.domainSuffix } : {}),
        ...(policy.match.ruleSet
          ? {
              ruleSet: policy.match.ruleSet.filter((tag) => activeRuleSetTags.has(tag)),
            }
          : {}),
      },
      resolvers:
        policy.action.type === "route" && policy.action.outboundGroup === "direct"
          ? [defaultDirectServerTag]
          : [defaultProxyServerTag],
    });
  }

  for (const override of input.intent.localOverrides.dnsPolicy ?? []) {
    nameserverPolicy.push({
      match: {
        domainSuffix: override.domainSuffix,
      },
      resolvers: override.server,
    });
  }

  return {
    mode: "real-ip",
    defaultResolvers: [defaultLocalServerTag],
    directResolvers: [defaultDirectServerTag],
    proxyResolvers: [defaultProxyServerTag],
    fallbackResolvers: [defaultProxyServerTag],
    servers,
    nameserverPolicy,
    fakeIpFilter: [],
    ...(input.intent.localOverrides.hosts
      ? {
          localHosts: input.intent.localOverrides.hosts,
        }
      : {}),
    strategy: input.intent.globals.preferIPv6 ? "prefer_ipv6" : "prefer_ipv4",
  };
}

export function compileDnsPlan(plan: DNSPlan): Record<string, unknown> {
  return {
    servers: plan.servers.map((server) => ({
      type: server.type,
      tag: server.tag,
      ...(server.preferGo ? { prefer_go: true } : {}),
      ...(server.server ? { server: server.server } : {}),
      ...(server.serverPort ? { server_port: server.serverPort } : {}),
    })),
    rules: plan.nameserverPolicy.map((rule) => ({
      ...(rule.match.domain ? { domain: [...rule.match.domain] } : {}),
      ...(rule.match.domainSuffix ? { domain_suffix: [...rule.match.domainSuffix] } : {}),
      ...(rule.match.ruleSet && rule.match.ruleSet.length > 0
        ? { rule_set: [...rule.match.ruleSet] }
        : {}),
      server: rule.resolvers[0],
    })),
    final: plan.defaultResolvers[0],
    strategy: plan.strategy,
    ...(plan.localHosts ? { hosts: plan.localHosts } : {}),
  };
}

export function getDefaultDnsServerTag(): string {
  return defaultLocalServerTag;
}
