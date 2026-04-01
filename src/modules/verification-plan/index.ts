import type { BuilderConfig } from "../../config/schema.js";
import type { DNSPlan } from "../../domain/dns-plan.js";
import type { IntentIR } from "../../domain/intent.js";
import type { VerificationPlan } from "../../domain/verification-plan.js";

export function buildVerificationPlan(input: {
  readonly config: BuilderConfig;
  readonly intent: IntentIR;
  readonly dnsPlan: DNSPlan;
}): VerificationPlan {
  const routeChecks = input.config.verification.scenarios.map((scenario) => ({
    id: scenario.id,
    name: scenario.name,
    target: scenario.url,
    inbound: scenario.inbound,
    expectedOutboundGroup: scenario.expectedOutbound,
    expectedRuleHint: inferRuleHint(scenario.expectedOutbound),
  }));

  const dnsChecks = dedupeBy(
    routeChecks.map((check) => ({
      domain: new URL(check.target).hostname,
      expectedMode: input.dnsPlan.mode,
      expectedResolver: resolveExpectedResolver(input.dnsPlan, new URL(check.target).hostname),
    })),
    (item) => item.domain,
  );

  const egressChecks = dedupeBy(
    routeChecks
      .filter((check) => check.expectedOutboundGroup !== "Process-Proxy")
      .map((check) => ({
        id: check.id,
        target: "https://api.ip.sb/geoip",
        inbound: check.inbound,
        expectedOutboundGroup: check.expectedOutboundGroup,
        ...(resolveExpectedCountries(input.config, check.expectedOutboundGroup).length > 0
          ? {
              expectedCountry: resolveExpectedCountries(input.config, check.expectedOutboundGroup),
            }
          : {}),
      })),
    (item) => `${item.inbound}:${item.expectedOutboundGroup}`,
  );

  const appChecks = dedupeBy(
    [
      ...input.intent.processPolicies.map((policy, index) => ({
        id: `process-${index + 1}`,
        app: (policy.match.processName ?? policy.match.bundleId ?? ["unknown"]).join(", "),
        expectedInbound: policy.inbound,
        expectedOutboundGroup: policy.outboundGroup,
      })),
      ...routeChecks
        .filter((check) => check.inbound === "in-proxifier")
        .map((check) => ({
          id: `scenario-${check.id}`,
          app: check.name,
          expectedInbound: "in-proxifier" as const,
          expectedOutboundGroup: check.expectedOutboundGroup,
        })),
    ],
    (item) => `${item.expectedInbound}:${item.expectedOutboundGroup}:${item.app}`,
  );

  const protocolChecks = dedupeBy(
    routeChecks.map((check) => ({
      id: `protocol-${check.id}`,
      target: check.target,
      expectTCPOnly: check.target.startsWith("https://"),
    })),
    (item) => item.target,
  );

  return {
    dnsChecks,
    routeChecks,
    egressChecks,
    appChecks,
    protocolChecks,
  };
}

function resolveExpectedResolver(plan: DNSPlan, hostname: string): string {
  for (const rule of plan.nameserverPolicy) {
    if (rule.match.domain?.includes(hostname)) {
      return rule.resolvers[0] ?? plan.defaultResolvers[0] ?? "unknown";
    }
    if (
      rule.match.domainSuffix?.some(
        (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
      )
    ) {
      return rule.resolvers[0] ?? plan.defaultResolvers[0] ?? "unknown";
    }
  }

  return plan.defaultResolvers[0] ?? "unknown";
}

function inferRuleHint(outboundGroup: string): string {
  switch (outboundGroup) {
    case "Process-Proxy":
      return "protected proxifier precedence";
    case "Stitch-Out":
      return "explicit stitch rule";
    case "AI-Out":
      return "AI service rule";
    case "Dev-Common-Out":
      return "developer/common service rule";
    case "direct":
      return "direct route";
    default:
      return "custom or group default";
  }
}

function resolveExpectedCountries(config: BuilderConfig, outboundGroup: string): readonly string[] {
  if (outboundGroup === "direct") {
    return ["CN"];
  }
  if (["HK", "SG", "US", "JP"].includes(outboundGroup)) {
    return [outboundGroup];
  }

  const groupTarget =
    outboundGroup === "AI-Out"
      ? config.groups.aiOut.defaultTarget
      : outboundGroup === "Dev-Common-Out"
        ? config.groups.devCommonOut.defaultTarget
        : outboundGroup === "Stitch-Out"
          ? config.groups.stitchOut.defaultTarget
          : outboundGroup === "Process-Proxy"
            ? config.groups.processProxy.defaultTarget
            : outboundGroup === "Global"
              ? config.groups.global.defaultTarget
              : undefined;

  return groupTarget && ["HK", "SG", "US", "JP"].includes(groupTarget) ? [groupTarget] : [];
}

function dedupeBy<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}
