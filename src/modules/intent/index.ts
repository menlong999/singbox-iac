import type {
  IntentIR,
  IntentPlacement,
  IntentProcessPolicy,
  IntentSitePolicy,
} from "../../domain/intent.js";
import type { NaturalLanguagePlan } from "../natural-language/index.js";
import type { LoadedUserRules, UserRouteRule } from "../user-rules/index.js";

export function createEmptyIntent(): IntentIR {
  return {
    version: "v1",
    globals: {},
    sitePolicies: [],
    processPolicies: [],
    localOverrides: {},
  };
}

export function intentFromUserRules(userRules: LoadedUserRules): IntentIR {
  return {
    ...createEmptyIntent(),
    sitePolicies: [
      ...userRules.beforeBuiltins.map((rule) => sitePolicyFromRule(rule, "beforeBuiltins")),
      ...userRules.afterBuiltins.map((rule) => sitePolicyFromRule(rule, "afterBuiltins")),
    ],
  };
}

export function intentFromNaturalLanguagePlan(plan: NaturalLanguagePlan): IntentIR {
  const processPolicies: IntentProcessPolicy[] = [];

  if (plan.groupDefaults?.processProxy?.defaultTarget) {
    processPolicies.push({
      name: "Prompt-directed proxifier routing",
      match: {
        processName: ["Antigravity", "Antigravity.app", "Cursor", "cursor", "claude", "gemini"],
      },
      inbound: "in-proxifier",
      outboundGroup: plan.groupDefaults.processProxy.defaultTarget,
      verify: {
        expectProxyHit: true,
      },
    });
  }

  return {
    version: "v1",
    globals: {
      ...(plan.scheduleIntervalMinutes
        ? { updateIntervalMinutes: plan.scheduleIntervalMinutes }
        : {}),
    },
    sitePolicies: [
      ...plan.beforeBuiltins.map((rule) => sitePolicyFromRule(rule, "beforeBuiltins")),
      ...plan.afterBuiltins.map((rule) => sitePolicyFromRule(rule, "afterBuiltins")),
    ],
    processPolicies,
    localOverrides: {},
  };
}

export function mergeIntents(intents: readonly IntentIR[]): IntentIR {
  return intents.reduce<IntentIR>(
    (merged, current) => ({
      version: "v1",
      globals: {
        ...merged.globals,
        ...current.globals,
      },
      sitePolicies: [...merged.sitePolicies, ...current.sitePolicies],
      processPolicies: [...merged.processPolicies, ...current.processPolicies],
      localOverrides: {
        ...(merged.localOverrides.hosts || current.localOverrides.hosts
          ? {
              hosts: {
                ...(merged.localOverrides.hosts ?? {}),
                ...(current.localOverrides.hosts ?? {}),
              },
            }
          : {}),
        ...(merged.localOverrides.dnsPolicy || current.localOverrides.dnsPolicy
          ? {
              dnsPolicy: [
                ...(merged.localOverrides.dnsPolicy ?? []),
                ...(current.localOverrides.dnsPolicy ?? []),
              ],
            }
          : {}),
      },
    }),
    createEmptyIntent(),
  );
}

function sitePolicyFromRule(rule: UserRouteRule, placement: IntentPlacement): IntentSitePolicy {
  return {
    placement,
    ...(rule.name ? { name: rule.name } : {}),
    match: {
      ...(rule.inbound ? { inbound: rule.inbound } : {}),
      ...(rule.protocol ? { protocol: rule.protocol } : {}),
      ...(rule.network ? { network: rule.network } : {}),
      ...(rule.port ? { port: rule.port } : {}),
      ...(rule.domain ? { domain: rule.domain } : {}),
      ...(rule.domainSuffix ? { domainSuffix: rule.domainSuffix } : {}),
      ...(rule.ruleSet ? { ruleSet: rule.ruleSet } : {}),
    },
    action: rule.route
      ? {
          type: "route",
          outboundGroup: rule.route,
        }
      : {
          type: "reject",
        },
  };
}
