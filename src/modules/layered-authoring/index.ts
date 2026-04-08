import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";
import { z } from "zod";

import type { BuilderConfig } from "../../config/schema.js";
import type { IntentIR } from "../../domain/intent.js";
import { intentFromNaturalLanguagePlan } from "../intent/index.js";
import type {
  NaturalLanguagePlan,
  NaturalLanguageVerificationOverride,
} from "../natural-language/index.js";
import { getRuleTemplate } from "../rule-templates/index.js";
import { type LoadedUserRules, type UserRouteRule, loadUserRules } from "../user-rules/index.js";

const nonEmptyString = z.string().min(1);

const routeRuleSchema = z
  .object({
    name: nonEmptyString.optional(),
    inbound: z.array(nonEmptyString).min(1).optional(),
    protocol: nonEmptyString.optional(),
    network: z.enum(["tcp", "udp"]).optional(),
    port: z.number().int().positive().optional(),
    domain: z.array(nonEmptyString).min(1).optional(),
    domainSuffix: z.array(nonEmptyString).min(1).optional(),
    ruleSet: z.array(nonEmptyString).min(1).optional(),
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
        message: "Each stored authored rule must define at least one matcher.",
      });
    }

    const actionCount = Number(rule.route !== undefined) + Number(rule.action !== undefined);
    if (actionCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Each stored authored rule must define exactly one action via "route" or action="reject".',
      });
    }
  });

const verificationOverrideSchema = z
  .object({
    inbound: z.enum(["in-mixed", "in-proxifier"]).optional(),
    domain: nonEmptyString.optional(),
    domainSuffix: nonEmptyString.optional(),
    expectedOutbound: nonEmptyString,
  })
  .superRefine((override, ctx) => {
    if (!override.domain && !override.domainSuffix) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Verification overrides must define domain or domainSuffix.",
      });
    }
  });

const groupOverrideSchema = z.object({
  defaultTarget: nonEmptyString.optional(),
  defaultNodePattern: nonEmptyString.optional(),
});

const naturalLanguagePlanSchema = z.object({
  beforeBuiltins: z.array(routeRuleSchema).default([]),
  afterBuiltins: z.array(routeRuleSchema).default([]),
  templateIds: z.array(nonEmptyString).default([]),
  notes: z.array(nonEmptyString).default([]),
  scheduleIntervalMinutes: z.number().int().positive().optional(),
  groupDefaults: z
    .object({
      processProxy: groupOverrideSchema.optional(),
      aiOut: groupOverrideSchema.optional(),
      devCommonOut: groupOverrideSchema.optional(),
      stitchOut: groupOverrideSchema.optional(),
    })
    .optional(),
  verificationOverrides: z.array(verificationOverrideSchema).optional(),
});

const authoringLayerSchema = z.object({
  prompt: nonEmptyString.optional(),
  appliedAt: nonEmptyString.optional(),
  plan: naturalLanguagePlanSchema,
});

const layeredAuthoringStateSchema = z.object({
  version: z.literal(1),
  base: authoringLayerSchema,
  patches: z.array(authoringLayerSchema).default([]),
});

export type AuthoringWriteMode = "patch" | "replace";

type ParsedNaturalLanguagePlan = z.infer<typeof naturalLanguagePlanSchema>;
type ParsedAuthoringLayer = z.infer<typeof authoringLayerSchema>;

export interface LayeredAuthoringLayer {
  readonly prompt?: string;
  readonly appliedAt?: string;
  readonly plan: NaturalLanguagePlan;
}

export interface LayeredAuthoringState {
  readonly version: 1;
  readonly base: LayeredAuthoringLayer;
  readonly patches: readonly LayeredAuthoringLayer[];
}

export interface ResolvedLayeredAuthoringState {
  readonly filePath: string;
  readonly exists: boolean;
  readonly state: LayeredAuthoringState;
  readonly mergedPlan: NaturalLanguagePlan;
  readonly mergedIntent: IntentIR;
}

export async function resolveLayeredAuthoringState(input: {
  readonly config: BuilderConfig;
  readonly rulesPath?: string;
  readonly loadedUserRules?: LoadedUserRules;
}): Promise<ResolvedLayeredAuthoringState> {
  const rulesPath = input.rulesPath ?? input.config.rules.userRulesFile;
  const filePath = resolveLayeredAuthoringPath(rulesPath);

  if (await pathExists(filePath)) {
    const raw = await readFile(filePath, "utf8");
    const state = parseLayeredAuthoringState(YAML.parse(raw) ?? {});
    return materializeLayeredAuthoringState({
      filePath,
      exists: true,
      state,
    });
  }

  const loadedUserRules = input.loadedUserRules ?? (await loadUserRules(rulesPath));
  const state = createLegacyLayeredAuthoringState(input.config, loadedUserRules);
  return materializeLayeredAuthoringState({
    filePath,
    exists: false,
    state,
  });
}

export function resolveLayeredAuthoringPath(rulesPath: string): string {
  const parsed = path.parse(rulesPath);
  const extension = parsed.ext || ".yaml";
  return path.join(parsed.dir, `${parsed.name}.authoring${extension}`);
}

export function applyLayeredAuthoringUpdate(input: {
  readonly current: LayeredAuthoringState;
  readonly prompt: string;
  readonly plan: NaturalLanguagePlan;
  readonly mode: AuthoringWriteMode;
  readonly appliedAt?: string;
}): LayeredAuthoringState {
  const nextLayer = {
    prompt: input.prompt,
    ...(input.appliedAt ? { appliedAt: input.appliedAt } : {}),
    plan: normalizePlan(input.plan),
  };

  if (input.mode === "replace") {
    return parseLayeredAuthoringState({
      version: 1,
      base: nextLayer,
      patches: [],
    });
  }

  return parseLayeredAuthoringState({
    version: 1,
    base: input.current.base,
    patches: [...input.current.patches, nextLayer],
  });
}

export async function writeLayeredAuthoringState(input: {
  readonly rulesPath: string;
  readonly state: LayeredAuthoringState;
}): Promise<string> {
  const filePath = resolveLayeredAuthoringPath(input.rulesPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  const normalized = parseLayeredAuthoringState(input.state);
  await writeFile(filePath, YAML.stringify(normalized), "utf8");
  return filePath;
}

export function mergeNaturalLanguagePlans(
  plans: readonly NaturalLanguagePlan[],
): NaturalLanguagePlan {
  if (plans.length === 0) {
    return {
      beforeBuiltins: [],
      afterBuiltins: [],
      templateIds: [],
      notes: [],
    };
  }

  const notes = new Set<string>();
  let scheduleIntervalMinutes: number | undefined;
  const groupDefaults: NonNullable<NaturalLanguagePlan["groupDefaults"]> = {};
  const verificationOverridesByKey = new Map<string, NaturalLanguageVerificationOverride>();

  for (const plan of plans) {
    for (const note of plan.notes) {
      notes.add(note);
    }

    if (plan.scheduleIntervalMinutes !== undefined) {
      scheduleIntervalMinutes = plan.scheduleIntervalMinutes;
    }

    if (plan.groupDefaults?.processProxy) {
      groupDefaults.processProxy = {
        ...(groupDefaults.processProxy ?? {}),
        ...plan.groupDefaults.processProxy,
      };
    }
    if (plan.groupDefaults?.aiOut) {
      groupDefaults.aiOut = {
        ...(groupDefaults.aiOut ?? {}),
        ...plan.groupDefaults.aiOut,
      };
    }
    if (plan.groupDefaults?.devCommonOut) {
      groupDefaults.devCommonOut = {
        ...(groupDefaults.devCommonOut ?? {}),
        ...plan.groupDefaults.devCommonOut,
      };
    }
    if (plan.groupDefaults?.stitchOut) {
      groupDefaults.stitchOut = {
        ...(groupDefaults.stitchOut ?? {}),
        ...plan.groupDefaults.stitchOut,
      };
    }

    for (const override of plan.verificationOverrides ?? []) {
      const key = verificationOverrideKey(override);
      verificationOverridesByKey.delete(key);
      verificationOverridesByKey.set(key, normalizeVerificationOverride(override));
    }
  }

  const beforeBuiltins: UserRouteRule[] = [];
  const afterBuiltins: UserRouteRule[] = [];
  const seenBefore = new Set<string>();
  const seenAfter = new Set<string>();
  const selectedTemplateFamilies = new Set<string>();
  const selectedTemplateIds: string[] = [];

  for (let index = plans.length - 1; index >= 0; index -= 1) {
    const plan = normalizePlan(plans[index] ?? emptyPlan());
    const { explicitBeforeBuiltins, explicitAfterBuiltins } = splitExplicitRules(plan);

    appendRules(explicitBeforeBuiltins, beforeBuiltins, seenBefore);
    appendRules(explicitAfterBuiltins, afterBuiltins, seenAfter);

    for (const templateId of plan.templateIds) {
      const family = templateFamily(templateId);
      if (selectedTemplateFamilies.has(family)) {
        continue;
      }

      const template = getRuleTemplate(templateId);
      if (!template) {
        throw new Error(`Unknown authored template "${templateId}".`);
      }

      selectedTemplateFamilies.add(family);
      selectedTemplateIds.push(templateId);
      appendRules(template.beforeBuiltins, beforeBuiltins, seenBefore);
      appendRules(template.afterBuiltins, afterBuiltins, seenAfter);
    }
  }

  return {
    beforeBuiltins,
    afterBuiltins,
    templateIds: selectedTemplateIds,
    notes: [...notes],
    ...(scheduleIntervalMinutes !== undefined ? { scheduleIntervalMinutes } : {}),
    ...(hasGroupDefaults(groupDefaults) ? { groupDefaults } : {}),
    ...(verificationOverridesByKey.size > 0
      ? { verificationOverrides: [...verificationOverridesByKey.values()] }
      : {}),
  };
}

export function materializeLayeredAuthoringState(input: {
  readonly filePath: string;
  readonly exists: boolean;
  readonly state: LayeredAuthoringState;
}): ResolvedLayeredAuthoringState {
  const mergedPlan = mergeNaturalLanguagePlans([
    input.state.base.plan,
    ...input.state.patches.map((layer) => layer.plan),
  ]);

  return {
    filePath: input.filePath,
    exists: input.exists,
    state: input.state,
    mergedPlan,
    mergedIntent: intentFromNaturalLanguagePlan(mergedPlan),
  };
}

function createLegacyLayeredAuthoringState(
  config: BuilderConfig,
  loadedUserRules: LoadedUserRules,
): LayeredAuthoringState {
  const verificationOverrides = config.verification.scenarios.map((scenario) => ({
    inbound: scenario.inbound,
    domain: new URL(scenario.url).hostname.toLowerCase(),
    expectedOutbound: scenario.expectedOutbound,
  }));

  const groupDefaults: NonNullable<NaturalLanguagePlan["groupDefaults"]> = {
    ...(config.groups.processProxy.defaultTarget || config.groups.processProxy.defaultNodePattern
      ? {
          processProxy: {
            ...(config.groups.processProxy.defaultTarget
              ? { defaultTarget: config.groups.processProxy.defaultTarget }
              : {}),
            ...(config.groups.processProxy.defaultNodePattern
              ? { defaultNodePattern: config.groups.processProxy.defaultNodePattern }
              : {}),
          },
        }
      : {}),
    ...(config.groups.aiOut.defaultTarget
      ? {
          aiOut: {
            defaultTarget: config.groups.aiOut.defaultTarget,
          },
        }
      : {}),
    ...(config.groups.devCommonOut.defaultTarget
      ? {
          devCommonOut: {
            defaultTarget: config.groups.devCommonOut.defaultTarget,
          },
        }
      : {}),
    ...(config.groups.stitchOut.defaultTarget
      ? {
          stitchOut: {
            defaultTarget: config.groups.stitchOut.defaultTarget,
          },
        }
      : {}),
  };

  return parseLayeredAuthoringState({
    version: 1,
    base: {
      plan: {
        beforeBuiltins: loadedUserRules.beforeBuiltins.map(normalizeRule),
        afterBuiltins: loadedUserRules.afterBuiltins.map(normalizeRule),
        templateIds: [],
        notes: [],
        ...(config.schedule.enabled
          ? { scheduleIntervalMinutes: config.schedule.intervalMinutes }
          : {}),
        ...(hasGroupDefaults(groupDefaults) ? { groupDefaults } : {}),
        ...(verificationOverrides.length > 0 ? { verificationOverrides } : {}),
      },
    },
    patches: [],
  });
}

function parseLayeredAuthoringState(value: unknown): LayeredAuthoringState {
  const parsed = layeredAuthoringStateSchema.parse(value);

  return {
    version: 1,
    base: parseLayer(parsed.base),
    patches: parsed.patches.map(parseLayer),
  };
}

function parseLayer(layer: ParsedAuthoringLayer): LayeredAuthoringLayer {
  return {
    ...(layer.prompt ? { prompt: layer.prompt } : {}),
    ...(layer.appliedAt ? { appliedAt: layer.appliedAt } : {}),
    plan: parseNaturalLanguagePlan(layer.plan),
  };
}

function parseNaturalLanguagePlan(value: unknown): NaturalLanguagePlan {
  const parsed = naturalLanguagePlanSchema.parse(value);

  return {
    beforeBuiltins: parsed.beforeBuiltins.map(normalizeParsedRule),
    afterBuiltins: parsed.afterBuiltins.map(normalizeParsedRule),
    templateIds: [...parsed.templateIds],
    notes: [...parsed.notes],
    ...(parsed.scheduleIntervalMinutes !== undefined
      ? { scheduleIntervalMinutes: parsed.scheduleIntervalMinutes }
      : {}),
    ...(parsed.groupDefaults
      ? { groupDefaults: normalizeGroupDefaults(parsed.groupDefaults) }
      : {}),
    ...(parsed.verificationOverrides
      ? {
          verificationOverrides: parsed.verificationOverrides.map(
            normalizeParsedVerificationOverride,
          ),
        }
      : {}),
  };
}

function splitExplicitRules(plan: NaturalLanguagePlan): {
  readonly explicitBeforeBuiltins: readonly UserRouteRule[];
  readonly explicitAfterBuiltins: readonly UserRouteRule[];
} {
  if (plan.templateIds.length === 0) {
    return {
      explicitBeforeBuiltins: plan.beforeBuiltins.map(normalizeRule),
      explicitAfterBuiltins: plan.afterBuiltins.map(normalizeRule),
    };
  }

  const templateBeforeKeys = new Set<string>();
  const templateAfterKeys = new Set<string>();

  for (const templateId of plan.templateIds) {
    const template = getRuleTemplate(templateId);
    if (!template) {
      throw new Error(`Unknown authored template "${templateId}".`);
    }
    for (const rule of template.beforeBuiltins) {
      templateBeforeKeys.add(exactRuleKey(rule));
    }
    for (const rule of template.afterBuiltins) {
      templateAfterKeys.add(exactRuleKey(rule));
    }
  }

  return {
    explicitBeforeBuiltins: plan.beforeBuiltins
      .map(normalizeRule)
      .filter((rule) => !templateBeforeKeys.has(exactRuleKey(rule))),
    explicitAfterBuiltins: plan.afterBuiltins
      .map(normalizeRule)
      .filter((rule) => !templateAfterKeys.has(exactRuleKey(rule))),
  };
}

function appendRules(
  candidates: readonly UserRouteRule[],
  output: UserRouteRule[],
  seenKeys: Set<string>,
): void {
  for (const rule of candidates) {
    const key = matchRuleKey(rule);
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    output.push(normalizeRule(rule));
  }
}

function normalizePlan(plan: NaturalLanguagePlan): NaturalLanguagePlan {
  return parseNaturalLanguagePlan({
    beforeBuiltins: plan.beforeBuiltins.map(normalizeRule),
    afterBuiltins: plan.afterBuiltins.map(normalizeRule),
    templateIds: [...plan.templateIds],
    notes: [...plan.notes],
    ...(plan.scheduleIntervalMinutes !== undefined
      ? { scheduleIntervalMinutes: plan.scheduleIntervalMinutes }
      : {}),
    ...(plan.groupDefaults ? { groupDefaults: plan.groupDefaults } : {}),
    ...(plan.verificationOverrides
      ? {
          verificationOverrides: plan.verificationOverrides.map(normalizeVerificationOverride),
        }
      : {}),
  });
}

function normalizeParsedRule(rule: z.infer<typeof routeRuleSchema>): UserRouteRule {
  return {
    ...(rule.name ? { name: rule.name } : {}),
    ...(rule.inbound ? { inbound: normalizeStringList(rule.inbound) } : {}),
    ...(rule.protocol ? { protocol: rule.protocol } : {}),
    ...(rule.network ? { network: rule.network } : {}),
    ...(rule.port ? { port: rule.port } : {}),
    ...(rule.domain ? { domain: normalizeStringList(rule.domain) } : {}),
    ...(rule.domainSuffix ? { domainSuffix: normalizeStringList(rule.domainSuffix) } : {}),
    ...(rule.ruleSet ? { ruleSet: normalizeStringList(rule.ruleSet) } : {}),
    ...(rule.route ? { route: rule.route } : {}),
    ...(rule.action ? { action: rule.action } : {}),
  };
}

function normalizeRule(rule: UserRouteRule): UserRouteRule {
  return {
    ...(rule.name ? { name: rule.name } : {}),
    ...(rule.inbound ? { inbound: normalizeStringList(rule.inbound) } : {}),
    ...(rule.protocol ? { protocol: rule.protocol } : {}),
    ...(rule.network ? { network: rule.network } : {}),
    ...(rule.port ? { port: rule.port } : {}),
    ...(rule.domain ? { domain: normalizeStringList(rule.domain) } : {}),
    ...(rule.domainSuffix ? { domainSuffix: normalizeStringList(rule.domainSuffix) } : {}),
    ...(rule.ruleSet ? { ruleSet: normalizeStringList(rule.ruleSet) } : {}),
    ...(rule.route ? { route: rule.route } : {}),
    ...(rule.action ? { action: rule.action } : {}),
  };
}

function normalizeVerificationOverride(
  override: NaturalLanguageVerificationOverride,
): NaturalLanguageVerificationOverride {
  const normalized = verificationOverrideSchema.parse({
    ...(override.inbound ? { inbound: override.inbound } : {}),
    ...(override.domain ? { domain: override.domain.toLowerCase() } : {}),
    ...(override.domainSuffix ? { domainSuffix: override.domainSuffix.toLowerCase() } : {}),
    expectedOutbound: override.expectedOutbound,
  });

  return {
    ...(normalized.inbound ? { inbound: normalized.inbound } : {}),
    ...(normalized.domain ? { domain: normalized.domain } : {}),
    ...(normalized.domainSuffix ? { domainSuffix: normalized.domainSuffix } : {}),
    expectedOutbound: normalized.expectedOutbound,
  };
}

function normalizeParsedVerificationOverride(
  override: z.infer<typeof verificationOverrideSchema>,
): NaturalLanguageVerificationOverride {
  return {
    ...(override.inbound ? { inbound: override.inbound } : {}),
    ...(override.domain ? { domain: override.domain.toLowerCase() } : {}),
    ...(override.domainSuffix ? { domainSuffix: override.domainSuffix.toLowerCase() } : {}),
    expectedOutbound: override.expectedOutbound,
  };
}

function normalizeGroupDefaults(
  groupDefaults: NonNullable<ParsedNaturalLanguagePlan["groupDefaults"]>,
): NonNullable<NaturalLanguagePlan["groupDefaults"]> {
  return {
    ...(groupDefaults.processProxy
      ? {
          processProxy: {
            ...(groupDefaults.processProxy.defaultTarget
              ? { defaultTarget: groupDefaults.processProxy.defaultTarget }
              : {}),
            ...(groupDefaults.processProxy.defaultNodePattern
              ? { defaultNodePattern: groupDefaults.processProxy.defaultNodePattern }
              : {}),
          },
        }
      : {}),
    ...(groupDefaults.aiOut
      ? {
          aiOut: {
            ...(groupDefaults.aiOut.defaultTarget
              ? { defaultTarget: groupDefaults.aiOut.defaultTarget }
              : {}),
            ...(groupDefaults.aiOut.defaultNodePattern
              ? { defaultNodePattern: groupDefaults.aiOut.defaultNodePattern }
              : {}),
          },
        }
      : {}),
    ...(groupDefaults.devCommonOut
      ? {
          devCommonOut: {
            ...(groupDefaults.devCommonOut.defaultTarget
              ? { defaultTarget: groupDefaults.devCommonOut.defaultTarget }
              : {}),
            ...(groupDefaults.devCommonOut.defaultNodePattern
              ? { defaultNodePattern: groupDefaults.devCommonOut.defaultNodePattern }
              : {}),
          },
        }
      : {}),
    ...(groupDefaults.stitchOut
      ? {
          stitchOut: {
            ...(groupDefaults.stitchOut.defaultTarget
              ? { defaultTarget: groupDefaults.stitchOut.defaultTarget }
              : {}),
            ...(groupDefaults.stitchOut.defaultNodePattern
              ? { defaultNodePattern: groupDefaults.stitchOut.defaultNodePattern }
              : {}),
          },
        }
      : {}),
  };
}

function emptyPlan(): NaturalLanguagePlan {
  return {
    beforeBuiltins: [],
    afterBuiltins: [],
    templateIds: [],
    notes: [],
  };
}

function matchRuleKey(rule: UserRouteRule): string {
  return JSON.stringify({
    inbound: rule.inbound ? normalizeStringList(rule.inbound) : [],
    protocol: rule.protocol ?? null,
    network: rule.network ?? null,
    port: rule.port ?? null,
    domain: rule.domain ? normalizeStringList(rule.domain) : [],
    domainSuffix: rule.domainSuffix ? normalizeStringList(rule.domainSuffix) : [],
    ruleSet: rule.ruleSet ? normalizeStringList(rule.ruleSet) : [],
  });
}

function exactRuleKey(rule: UserRouteRule): string {
  return JSON.stringify({
    ...JSON.parse(matchRuleKey(rule)),
    route: rule.route ?? null,
    action: rule.action ?? null,
  });
}

function verificationOverrideKey(override: NaturalLanguageVerificationOverride): string {
  return JSON.stringify({
    inbound: override.inbound ?? null,
    domain: override.domain?.toLowerCase() ?? null,
    domainSuffix: override.domainSuffix?.toLowerCase() ?? null,
  });
}

function templateFamily(templateId: string): string {
  if (templateId === "video-us" || templateId === "video-hk" || templateId === "video-sg") {
    return "video-global";
  }

  return templateId;
}

function hasGroupDefaults(
  groupDefaults: NonNullable<NaturalLanguagePlan["groupDefaults"]>,
): boolean {
  return Object.keys(groupDefaults).length > 0;
}

function normalizeStringList(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
