import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { z } from "zod";

import type { BuilderConfig } from "../../config/schema.js";
import {
  type NaturalLanguagePlan,
  type NaturalLanguageVerificationOverride,
  generateRulesFromPrompt,
} from "../natural-language/index.js";
import { mergeRuleTemplates } from "../rule-templates/index.js";
import type { UserRouteRule } from "../user-rules/index.js";

const providerSchema = z.enum(["deterministic", "auto", "claude", "exec"]);

const nonEmptyString = z.string().min(1);
const stringOrStringArray = z.union([nonEmptyString, z.array(nonEmptyString).min(1)]);

const authoringRuleSchema = z.object({
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
});

const groupOverrideSchema = z.object({
  defaultTarget: nonEmptyString.optional(),
  defaultNodePattern: nonEmptyString.optional(),
});

const verificationOverrideSchema = z.object({
  inbound: z.enum(["in-mixed", "in-proxifier"]).optional(),
  domain: nonEmptyString.optional(),
  domainSuffix: nonEmptyString.optional(),
  expectedOutbound: nonEmptyString,
});

const authoredPlanSchema = z.object({
  beforeBuiltins: z.array(authoringRuleSchema).default([]),
  afterBuiltins: z.array(authoringRuleSchema).default([]),
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
    .default({}),
  verificationOverrides: z.array(verificationOverrideSchema).default([]),
});

export type AuthoringProvider = z.infer<typeof providerSchema>;

export interface AuthoringCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

export interface LocalAiCli {
  readonly id: string;
  readonly command: string;
  readonly path?: string;
  readonly installed: boolean;
  readonly authoringSupport: "builtin" | "exec" | "tooling-only";
}

export interface GenerateAuthoringPlanInput {
  readonly prompt: string;
  readonly config?: BuilderConfig;
  readonly provider?: AuthoringProvider;
  readonly execCommand?: string;
  readonly execArgs?: readonly string[];
  readonly timeoutMs?: number;
  readonly runner?: AuthoringCommandRunner;
}

export interface GenerateAuthoringPlanResult {
  readonly plan: NaturalLanguagePlan;
  readonly providerRequested: AuthoringProvider;
  readonly providerUsed: Exclude<AuthoringProvider, "auto">;
}

export type AuthoringCommandRunner = (input: {
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
}) => Promise<AuthoringCommandResult>;

const defaultTimeoutMs = 4_000;

const planJsonSchema = JSON.stringify({
  type: "object",
  additionalProperties: false,
  properties: {
    beforeBuiltins: {
      type: "array",
      items: { type: "object" },
    },
    afterBuiltins: {
      type: "array",
      items: { type: "object" },
    },
    templateIds: {
      type: "array",
      items: { type: "string" },
    },
    notes: {
      type: "array",
      items: { type: "string" },
    },
    scheduleIntervalMinutes: { type: "integer", minimum: 1 },
    groupDefaults: {
      type: "object",
      additionalProperties: false,
      properties: {
        processProxy: { type: "object" },
        aiOut: { type: "object" },
        devCommonOut: { type: "object" },
        stitchOut: { type: "object" },
      },
    },
    verificationOverrides: {
      type: "array",
      items: { type: "object" },
    },
  },
});

export async function generateAuthoringPlan(
  input: GenerateAuthoringPlanInput,
): Promise<GenerateAuthoringPlanResult> {
  const providerRequested = input.provider ?? input.config?.authoring.provider ?? "deterministic";
  const timeoutMs = input.timeoutMs ?? input.config?.authoring.timeoutMs ?? defaultTimeoutMs;
  const runner = input.runner ?? runAuthoringCommand;

  if (providerRequested === "deterministic") {
    return {
      providerRequested,
      providerUsed: "deterministic",
      plan: generateRulesFromPrompt(input.prompt),
    };
  }

  if (providerRequested === "claude") {
    return {
      providerRequested,
      providerUsed: "claude",
      plan: await generateWithClaude(input.prompt, input.config, timeoutMs, runner),
    };
  }

  if (providerRequested === "exec") {
    return {
      providerRequested,
      providerUsed: "exec",
      plan: await generateWithExec(
        input.prompt,
        input.config,
        {
          command: input.execCommand ?? input.config?.authoring.exec?.command,
          args: input.execArgs ?? input.config?.authoring.exec?.args,
        },
        timeoutMs,
        runner,
      ),
    };
  }

  return generateWithAuto(
    input.prompt,
    input.config,
    input.execCommand,
    input.execArgs,
    timeoutMs,
    runner,
  );
}

export async function detectLocalAiClis(): Promise<readonly LocalAiCli[]> {
  const catalog: Array<Pick<LocalAiCli, "id" | "command" | "authoringSupport">> = [
    { id: "claude", command: "claude", authoringSupport: "builtin" },
    { id: "gemini", command: "gemini", authoringSupport: "exec" },
    { id: "codebuddy", command: "codebuddy", authoringSupport: "exec" },
    { id: "cbc", command: "cbc", authoringSupport: "exec" },
    { id: "opencode", command: "opencode", authoringSupport: "exec" },
    { id: "codex", command: "codex", authoringSupport: "exec" },
    { id: "qodercli", command: "qodercli", authoringSupport: "exec" },
    { id: "qoder", command: "qoder", authoringSupport: "exec" },
    { id: "qwen", command: "qwen", authoringSupport: "exec" },
    { id: "trae", command: "trae", authoringSupport: "tooling-only" },
  ];

  const resolved = await Promise.all(
    catalog.map(async (entry) => {
      const resolvedPath = await resolveExecutable(entry.command);
      return {
        ...entry,
        installed: resolvedPath !== undefined,
        ...(resolvedPath ? { path: resolvedPath } : {}),
      };
    }),
  );

  const dedupedByPath = new Map<string, LocalAiCli>();
  for (const entry of resolved) {
    if (!entry.installed || !entry.path) {
      dedupedByPath.set(`missing:${entry.id}`, entry);
      continue;
    }

    const existing = dedupedByPath.get(entry.path);
    if (!existing) {
      dedupedByPath.set(entry.path, entry);
      continue;
    }

    if (
      rankAuthoringSupport(entry.authoringSupport) > rankAuthoringSupport(existing.authoringSupport)
    ) {
      dedupedByPath.set(entry.path, entry);
    }
  }

  return [...dedupedByPath.values()];
}

async function generateWithAuto(
  prompt: string,
  config: BuilderConfig | undefined,
  execCommand: string | undefined,
  execArgs: readonly string[] | undefined,
  timeoutMs: number,
  runner: AuthoringCommandRunner,
): Promise<GenerateAuthoringPlanResult> {
  if (execCommand || config?.authoring.exec?.command) {
    try {
      return {
        providerRequested: "auto",
        providerUsed: "exec",
        plan: await generateWithExec(
          prompt,
          config,
          {
            command: execCommand ?? config?.authoring.exec?.command,
            args: execArgs ?? config?.authoring.exec?.args,
          },
          timeoutMs,
          runner,
        ),
      };
    } catch (error) {
      return fallbackDeterministic(
        prompt,
        "exec",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const claudePath = await resolveExecutable("claude");
  if (claudePath) {
    try {
      return {
        providerRequested: "auto",
        providerUsed: "claude",
        plan: await generateWithClaude(prompt, config, timeoutMs, runner, claudePath),
      };
    } catch (error) {
      return fallbackDeterministic(
        prompt,
        "claude",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return {
    providerRequested: "auto",
    providerUsed: "deterministic",
    plan: appendNotes(generateRulesFromPrompt(prompt), [
      "Auto authoring fell back to the built-in deterministic parser because no supported local AI CLI was available.",
    ]),
  };
}

async function generateWithClaude(
  prompt: string,
  config: BuilderConfig | undefined,
  timeoutMs: number,
  runner: AuthoringCommandRunner,
  explicitCommand?: string,
): Promise<NaturalLanguagePlan> {
  const command = explicitCommand ?? (await resolveExecutable("claude"));
  if (!command) {
    throw new Error('The "claude" CLI was not found on PATH.');
  }

  const args = [
    "-p",
    "--tools",
    "",
    "--no-session-persistence",
    "--permission-mode",
    "dontAsk",
    "--output-format",
    "json",
    "--json-schema",
    planJsonSchema,
    "--system-prompt",
    buildAuthoringSystemPrompt(config),
    prompt,
  ];

  const result = await runner({
    command,
    args,
    timeoutMs,
  });

  if (result.timedOut) {
    throw new Error(`The "claude" CLI did not produce a plan within ${timeoutMs} ms.`);
  }
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || '"claude" failed.');
  }

  return normalizeAuthoredPlan(JSON.parse(result.stdout));
}

async function generateWithExec(
  prompt: string,
  config: BuilderConfig | undefined,
  exec: {
    readonly command: string | undefined;
    readonly args: readonly string[] | undefined;
  },
  timeoutMs: number,
  runner: AuthoringCommandRunner,
): Promise<NaturalLanguagePlan> {
  if (!exec.command) {
    throw new Error('The "exec" authoring provider requires a command.');
  }

  const command = (await resolveExecutable(exec.command)) ?? exec.command;
  const contextJson = JSON.stringify(buildAuthoringContext(config));
  const fullPrompt = buildPortableExecPrompt(config, prompt);
  const rawArgs = exec.args ?? [];
  const needsSchemaFile = rawArgs.some((value) => value.includes("{{schema_file}}"));
  const needsOutputFile = rawArgs.some((value) => value.includes("{{output_file}}"));
  const tempDir =
    needsSchemaFile || needsOutputFile
      ? await mkdtemp(path.join(tmpdir(), "singbox-iac-author-exec-"))
      : undefined;
  const schemaFilePath = tempDir ? path.join(tempDir, "authoring.schema.json") : undefined;
  const outputFilePath = tempDir ? path.join(tempDir, "authoring.output.json") : undefined;

  try {
    if (schemaFilePath && needsSchemaFile) {
      await writeFile(schemaFilePath, planJsonSchema, "utf8");
    }

    const args = rawArgs.map((value) =>
      value
        .replaceAll("{{prompt}}", prompt)
        .replaceAll("{{schema}}", planJsonSchema)
        .replaceAll("{{context_json}}", contextJson)
        .replaceAll("{{full_prompt}}", fullPrompt)
        .replaceAll("{{schema_file}}", schemaFilePath ?? "")
        .replaceAll("{{output_file}}", outputFilePath ?? ""),
    );

    const result = await runner({
      command,
      args,
      timeoutMs,
      env: {
        ...process.env,
        SINGBOX_IAC_AUTHOR_PROMPT: prompt,
        SINGBOX_IAC_AUTHOR_SCHEMA: planJsonSchema,
        SINGBOX_IAC_AUTHOR_CONTEXT: contextJson,
        SINGBOX_IAC_AUTHOR_FULL_PROMPT: fullPrompt,
        ...(schemaFilePath ? { SINGBOX_IAC_AUTHOR_SCHEMA_FILE: schemaFilePath } : {}),
        ...(outputFilePath ? { SINGBOX_IAC_AUTHOR_OUTPUT_FILE: outputFilePath } : {}),
      },
    });

    if (result.timedOut) {
      throw new Error(`The exec authoring provider timed out after ${timeoutMs} ms.`);
    }
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || "exec provider failed.");
    }

    const rawOutput = outputFilePath ? await readFile(outputFilePath, "utf8") : result.stdout;
    return normalizeAuthoredPlan(parseJsonObjectFromText(rawOutput));
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

function normalizeAuthoredPlan(input: unknown): NaturalLanguagePlan {
  const parsed = authoredPlanSchema.parse(input);
  const mergedTemplates = mergeRuleTemplates(parsed.templateIds);

  return {
    beforeBuiltins: dedupeRules([
      ...mergedTemplates.beforeBuiltins,
      ...parsed.beforeBuiltins.map(normalizeRule),
    ]),
    afterBuiltins: dedupeRules([
      ...mergedTemplates.afterBuiltins,
      ...parsed.afterBuiltins.map(normalizeRule),
    ]),
    templateIds: parsed.templateIds,
    notes: parsed.notes,
    ...(parsed.scheduleIntervalMinutes
      ? { scheduleIntervalMinutes: parsed.scheduleIntervalMinutes }
      : {}),
    ...(Object.keys(parsed.groupDefaults).length > 0
      ? { groupDefaults: sanitizeGroupDefaults(parsed.groupDefaults) }
      : {}),
    ...(parsed.verificationOverrides.length > 0
      ? { verificationOverrides: sanitizeVerificationOverrides(parsed.verificationOverrides) }
      : {}),
  };
}

function normalizeRule(rule: z.infer<typeof authoringRuleSchema>): UserRouteRule {
  const normalized: {
    name?: string;
    inbound?: readonly string[];
    protocol?: string;
    network?: "tcp" | "udp";
    port?: number;
    domain?: readonly string[];
    domainSuffix?: readonly string[];
    ruleSet?: readonly string[];
    route?: string;
    action?: "reject";
  } = {};

  if (rule.name) {
    normalized.name = rule.name;
  }
  if (rule.inbound) {
    normalized.inbound = toArray(rule.inbound);
  }
  if (rule.protocol) {
    normalized.protocol = rule.protocol;
  }
  if (rule.network) {
    normalized.network = rule.network;
  }
  if (rule.port) {
    normalized.port = rule.port;
  }
  if (rule.domain) {
    normalized.domain = toArray(rule.domain);
  }
  if (rule.domainSuffix) {
    normalized.domainSuffix = toArray(rule.domainSuffix);
  }
  if (rule.ruleSet) {
    normalized.ruleSet = toArray(rule.ruleSet);
  }
  if (rule.route) {
    normalized.route = rule.route;
  }
  if (rule.action) {
    normalized.action = rule.action;
  }

  return normalized;
}

function toArray(value: string | readonly string[]): readonly string[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [value as string];
}

function dedupeRules(rules: readonly UserRouteRule[]): readonly UserRouteRule[] {
  const byKey = new Map<string, UserRouteRule>();
  for (const rule of rules) {
    byKey.set(JSON.stringify(rule), rule);
  }
  return [...byKey.values()];
}

function buildAuthoringSystemPrompt(config?: BuilderConfig): string {
  const context = buildAuthoringContext(config);
  return [
    "You translate short routing prompts into singbox-iac rule plans.",
    "Respond only with JSON matching the supplied schema.",
    "Use templateIds for common site bundles when possible.",
    "Use beforeBuiltins for non-direct overrides and afterBuiltins for direct routing.",
    "Do not invent process-matching rules for IDE or Proxifier phrases; emit a short note instead.",
    `Allowed route targets: ${context.allowedRoutes.join(", ")}`,
    `Available templateIds: ${context.templateIds.join(", ")}`,
    `Available ruleSet tags: ${context.ruleSetTags.join(", ") || "(none)"}`,
  ].join(" ");
}

function buildAuthoringContext(config?: BuilderConfig): {
  readonly allowedRoutes: readonly string[];
  readonly templateIds: readonly string[];
  readonly ruleSetTags: readonly string[];
} {
  const allowedRoutes = new Set<string>([
    "direct",
    "Global",
    "Process-Proxy",
    "AI-Out",
    "Dev-Common-Out",
    "Stitch-Out",
    "HK",
    "SG",
    "US",
    "JP",
  ]);

  if (config) {
    for (const region of [
      ...config.groups.global.includes,
      ...config.groups.processProxy.includes,
      ...config.groups.aiOut.includes,
      ...config.groups.devCommonOut.includes,
      ...config.groups.stitchOut.includes,
    ]) {
      allowedRoutes.add(region);
    }
  }

  return {
    allowedRoutes: [...allowedRoutes],
    templateIds: [
      "developer-ai-sites",
      "developer-common-sites",
      "video-us",
      "video-hk",
      "video-sg",
      "video-jp",
      "cn-video-direct",
    ],
    ruleSetTags: config?.ruleSets.map((ruleSet) => ruleSet.tag) ?? [],
  };
}

function buildPortableExecPrompt(config: BuilderConfig | undefined, prompt: string): string {
  return [
    "Translate the following routing request into a singbox-iac authoring plan.",
    "Return only one JSON object and nothing else.",
    "The JSON object must match this schema:",
    planJsonSchema,
    "Authoring context:",
    JSON.stringify(buildAuthoringContext(config)),
    "User request:",
    prompt,
  ].join("\n");
}

function fallbackDeterministic(
  prompt: string,
  providerUsed: Exclude<AuthoringProvider, "auto" | "deterministic">,
  reason: string,
): GenerateAuthoringPlanResult {
  return {
    providerRequested: "auto",
    providerUsed: "deterministic",
    plan: appendNotes(generateRulesFromPrompt(prompt), [
      `Auto authoring fell back from ${providerUsed} to the deterministic parser: ${reason}`,
    ]),
  };
}

function appendNotes(
  plan: NaturalLanguagePlan,
  extraNotes: readonly string[],
): NaturalLanguagePlan {
  return {
    ...plan,
    notes: [...plan.notes, ...extraNotes],
  };
}

function sanitizeGroupDefaults(
  groupDefaults: z.infer<typeof authoredPlanSchema>["groupDefaults"],
): NonNullable<NaturalLanguagePlan["groupDefaults"]> {
  const sanitized: NonNullable<NaturalLanguagePlan["groupDefaults"]> = {};
  for (const [key, value] of Object.entries(groupDefaults)) {
    if (!value) {
      continue;
    }

    const nextValue = {
      ...(value.defaultTarget ? { defaultTarget: value.defaultTarget } : {}),
      ...(value.defaultNodePattern ? { defaultNodePattern: value.defaultNodePattern } : {}),
    };
    if (Object.keys(nextValue).length === 0) {
      continue;
    }

    sanitized[key as keyof typeof sanitized] = nextValue;
  }
  return sanitized;
}

function sanitizeVerificationOverrides(
  overrides: z.infer<typeof authoredPlanSchema>["verificationOverrides"],
): readonly NaturalLanguageVerificationOverride[] {
  return overrides.map((override) => ({
    ...(override.inbound ? { inbound: override.inbound } : {}),
    ...(override.domain ? { domain: override.domain } : {}),
    ...(override.domainSuffix ? { domainSuffix: override.domainSuffix } : {}),
    expectedOutbound: override.expectedOutbound,
  }));
}

function rankAuthoringSupport(support: LocalAiCli["authoringSupport"]): number {
  switch (support) {
    case "builtin":
      return 3;
    case "exec":
      return 2;
    case "tooling-only":
      return 1;
  }
}

async function resolveExecutable(command: string): Promise<string | undefined> {
  if (command.includes(path.sep)) {
    return (await isExecutable(command)) ? command : undefined;
  }

  const pathValue = process.env.PATH ?? "";
  for (const entry of pathValue.split(path.delimiter)) {
    if (!entry) {
      continue;
    }

    const candidate = path.join(entry, command);
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function runAuthoringCommand(input: {
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
}): Promise<AuthoringCommandResult> {
  return new Promise<AuthoringCommandResult>((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      env: input.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        child.kill("SIGKILL");
      }, 500).unref();
    }, input.timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut,
      });
    });
  });
}

function parseJsonObjectFromText(rawText: string): unknown {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    throw new Error("Authoring provider returned empty output.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const candidate = fencedMatch[1].trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced) {
    return JSON.parse(balanced);
  }

  throw new Error("Could not extract a JSON authoring plan from provider output.");
}

function extractBalancedJsonObject(text: string): string | undefined {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === undefined) {
      continue;
    }

    if (escaping) {
      escaping = false;
      continue;
    }
    if (character === "\\") {
      escaping = true;
      continue;
    }
    if (character === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return undefined;
}
