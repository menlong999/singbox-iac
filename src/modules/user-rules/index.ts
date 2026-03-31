import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";

import YAML from "yaml";
import { z } from "zod";

const nonEmptyString = z.string().min(1);

const stringOrStringArray = z.union([nonEmptyString, z.array(nonEmptyString).min(1)]);

const dslRuleSchema = z
  .object({
    name: nonEmptyString.optional(),
    inbound: stringOrStringArray.optional(),
    protocol: nonEmptyString.optional(),
    network: z.enum(["tcp", "udp"]).optional(),
    port: z.number().int().positive().optional(),
    domain: stringOrStringArray.optional(),
    domainSuffix: stringOrStringArray.optional(),
    ruleSet: stringOrStringArray.optional(),
    route: nonEmptyString.optional(),
    action: z.literal("reject").optional(),
  })
  .superRefine((rule, ctx) => {
    const hasMatch =
      rule.inbound !== undefined ||
      rule.protocol !== undefined ||
      rule.network !== undefined ||
      rule.port !== undefined ||
      rule.domain !== undefined ||
      rule.domainSuffix !== undefined ||
      rule.ruleSet !== undefined;

    if (!hasMatch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each rule must define at least one matcher.",
      });
    }

    const actionCount = Number(rule.route !== undefined) + Number(rule.action !== undefined);
    if (actionCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Each rule must define exactly one action via "route" or action="reject".',
      });
    }
  });

const userRulesFileSchema = z.object({
  version: z.literal(1).default(1),
  beforeBuiltins: z.array(dslRuleSchema).default([]),
  afterBuiltins: z.array(dslRuleSchema).default([]),
});

export interface UserRouteRule {
  readonly name?: string;
  readonly inbound?: readonly string[];
  readonly protocol?: string;
  readonly network?: "tcp" | "udp";
  readonly port?: number;
  readonly domain?: readonly string[];
  readonly domainSuffix?: readonly string[];
  readonly ruleSet?: readonly string[];
  readonly route?: string;
  readonly action?: "reject";
}

export interface LoadedUserRules {
  readonly beforeBuiltins: readonly UserRouteRule[];
  readonly afterBuiltins: readonly UserRouteRule[];
  readonly warnings: readonly string[];
}

export async function loadUserRules(filePath: string): Promise<LoadedUserRules> {
  if (!filePath) {
    return emptyUserRules();
  }

  if (!(await fileExists(filePath))) {
    return {
      ...emptyUserRules(),
      warnings: [`User rules file was not found at ${filePath}; continuing without custom rules.`],
    };
  }

  const raw = await readFile(filePath, "utf8");
  const parsed = userRulesFileSchema.parse(YAML.parse(raw) ?? {});
  return {
    beforeBuiltins: parsed.beforeBuiltins.map(normalizeRule),
    afterBuiltins: parsed.afterBuiltins.map(normalizeRule),
    warnings: [],
  };
}

function normalizeRule(rule: z.infer<typeof dslRuleSchema>): UserRouteRule {
  return {
    ...(rule.name ? { name: rule.name } : {}),
    ...(rule.inbound ? { inbound: toArray(rule.inbound) } : {}),
    ...(rule.protocol ? { protocol: rule.protocol } : {}),
    ...(rule.network ? { network: rule.network } : {}),
    ...(rule.port ? { port: rule.port } : {}),
    ...(rule.domain ? { domain: toArray(rule.domain) } : {}),
    ...(rule.domainSuffix ? { domainSuffix: toArray(rule.domainSuffix) } : {}),
    ...(rule.ruleSet ? { ruleSet: toArray(rule.ruleSet) } : {}),
    ...(rule.route ? { route: rule.route } : {}),
    ...(rule.action ? { action: rule.action } : {}),
  };
}

function toArray(value: string | string[]): readonly string[] {
  return Array.isArray(value) ? value : [value];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function emptyUserRules(): LoadedUserRules {
  return {
    beforeBuiltins: [],
    afterBuiltins: [],
    warnings: [],
  };
}
