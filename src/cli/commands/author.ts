import path from "node:path";

import type { Command } from "commander";

import { generateAuthoringPlan } from "../../modules/authoring/index.js";
import { buildConfigArtifact, resolveEffectiveIntent } from "../../modules/build/index.js";
import {
  applyPlanToBuilderConfig,
  updateBuilderAuthoring,
  writeGeneratedRules,
} from "../../modules/natural-language/index.js";
import { generateAuthoringPreview } from "../../modules/preview/index.js";
import { installLaunchdSchedule } from "../../modules/schedule/index.js";
import { runUpdate } from "../../modules/update/index.js";
import {
  findDefaultConfigPath,
  resolveBuilderConfig,
  resolveCliEntrypoint,
} from "../command-helpers.js";

export function registerAuthorCommand(program: Command): void {
  program
    .command("author")
    .description("Advanced rule authoring from a natural-language prompt.")
    .requiredOption("-p, --prompt <text>", "natural-language routing prompt")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--provider <provider>", "authoring provider: deterministic, auto, claude, exec")
    .option("--author-timeout-ms <ms>", "timeout for local AI CLI authoring")
    .option("--exec-command <command>", "command for the exec authoring provider")
    .option(
      "--exec-arg <arg>",
      "append one argument for the exec authoring provider",
      collectOption,
      [],
    )
    .option("--rules-out <path>", "override the target custom-rules file")
    .option("--subscription-url <url>", "override subscription URL when building")
    .option("--subscription-file <path>", "use a local subscription file instead of fetching")
    .option("--preview", "print rules/config/staging diffs without writing any files")
    .option("--diff", "print intent/rules/config diffs without writing any files")
    .option("--emit-intent-ir", "print the generated Intent IR and exit without writing files")
    .option("--strict", "reject ambiguous natural-language requests instead of guessing")
    .option("--skip-build", "write rules only and skip config generation")
    .option("--update", "after writing rules, run build + verify + publish")
    .option("--skip-verify", "when used with --update, skip runtime verification before publish")
    .option("--reload", "when used with --update, reload sing-box after publish")
    .option("--live-path <path>", "override live config path when using --update")
    .option("--backup-path <path>", "override backup config path when using --update")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--chrome-bin <path>", "path to Chrome binary for runtime verification")
    .option("--install-schedule", "install a launchd job after writing rules and building")
    .option("--label <label>", "LaunchAgent label", "org.singbox-iac.update")
    .option("--launch-agents-dir <path>", "override LaunchAgents directory")
    .option("--logs-dir <path>", "override launchd log directory")
    .option("-f, --force-schedule", "replace an existing LaunchAgent file when installing")
    .option("--no-load", "write the LaunchAgent without calling launchctl bootstrap")
    .action(async (options: AuthorCommandOptions) => {
      await runAuthorFlow(options);
    });
}

export async function runAuthorFlow(options: AuthorCommandOptions): Promise<void> {
  const [builderConfig, configPath] = await Promise.all([
    resolveBuilderConfig(options),
    options.config ? Promise.resolve(resolvePath(options.config)) : findDefaultConfigPath(),
  ]);
  if (!builderConfig || !configPath) {
    throw new Error("author requires a builder config. Pass --config or run init first.");
  }
  if (options.update && options.skipBuild) {
    throw new Error("author cannot use --update together with --skip-build.");
  }

  const planResult = await generateAuthoringPlan({
    prompt: options.prompt,
    config: builderConfig,
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.authorTimeoutMs ? { timeoutMs: Number.parseInt(options.authorTimeoutMs, 10) } : {}),
    ...(options.execCommand ? { execCommand: options.execCommand } : {}),
    ...(options.execArg.length > 0 ? { execArgs: options.execArg } : {}),
    ...(options.strict ? { strict: true } : {}),
  });
  const plan = planResult.plan;
  const rulesPath = options.rulesOut
    ? resolvePath(options.rulesOut)
    : builderConfig.rules.userRulesFile;
  const effectiveConfig = applyPlanToBuilderConfig(builderConfig, {
    rulesPath,
    plan,
  });

  if (options.emitIntentIr) {
    process.stdout.write(`${JSON.stringify(planResult.intent, null, 2)}\n`);
    return;
  }

  if (options.preview || options.diff) {
    const currentIntent = await resolveEffectiveIntent(builderConfig);
    const preview = await generateAuthoringPreview({
      configPath,
      config: builderConfig,
      plan,
      rulesPath,
      currentIntent,
      proposedIntent: planResult.intent,
      ...(options.subscriptionFile ? { subscriptionFile: options.subscriptionFile } : {}),
      ...(options.subscriptionUrl ? { subscriptionUrl: options.subscriptionUrl } : {}),
      buildStaging: !options.skipBuild,
    });

    const lines = [
      `Config: ${configPath}`,
      `Rules: ${rulesPath}`,
      `Provider requested: ${planResult.providerRequested}`,
      `Provider used: ${planResult.providerUsed}`,
      `Templates: ${plan.templateIds.length > 0 ? plan.templateIds.join(", ") : "(none)"}`,
      `Generated rules: ${plan.beforeBuiltins.length + plan.afterBuiltins.length}`,
      `${options.diff ? "Diff" : "Preview"} mode: no files were written.`,
    ];
    if (planResult.ambiguities.length > 0) {
      lines.push(`Ambiguities detected: ${planResult.ambiguities.length}`);
      lines.push(...planResult.ambiguities.map((ambiguity) => `- ${ambiguity}`));
    }
    if (plan.notes.length > 0) {
      lines.push(`Notes: ${plan.notes.length}`);
      lines.push(...plan.notes.map((note) => `- ${note}`));
    }
    if (options.installSchedule) {
      lines.push("Schedule install: requested, but skipped in preview mode.");
    }
    if (options.update) {
      lines.push("Live update: requested, but skipped in preview mode.");
    }
    lines.push("");
    lines.push("Intent IR diff:");
    lines.push(preview.intentDiff.diff);
    lines.push("");
    lines.push("Rules diff:");
    lines.push(preview.rulesDiff.diff);
    lines.push("");
    lines.push("Builder config diff:");
    lines.push(preview.configDiff.diff);
    if (preview.stagingDiff) {
      lines.push("");
      lines.push("Staging config diff:");
      lines.push(preview.stagingDiff.diff);
    }

    process.stdout.write(`${lines.join("\n")}\n`);
    return;
  }

  await writeGeneratedRules({
    filePath: rulesPath,
    plan,
  });
  await updateBuilderAuthoring({
    configPath,
    rulesPath,
    ...(plan.scheduleIntervalMinutes ? { intervalMinutes: plan.scheduleIntervalMinutes } : {}),
    ...(plan.groupDefaults ? { groupDefaults: plan.groupDefaults } : {}),
    ...(plan.verificationOverrides ? { verificationOverrides: plan.verificationOverrides } : {}),
  });

  const lines = [
    `Config: ${configPath}`,
    `Rules: ${rulesPath}`,
    `Provider requested: ${planResult.providerRequested}`,
    `Provider used: ${planResult.providerUsed}`,
    `Templates: ${plan.templateIds.length > 0 ? plan.templateIds.join(", ") : "(none)"}`,
    `Generated rules: ${plan.beforeBuiltins.length + plan.afterBuiltins.length}`,
  ];
  if (planResult.ambiguities.length > 0) {
    lines.push(`Ambiguities detected: ${planResult.ambiguities.length}`);
    lines.push(...planResult.ambiguities.map((ambiguity) => `- ${ambiguity}`));
  }
  if (plan.notes.length > 0) {
    lines.push(`Notes: ${plan.notes.length}`);
    lines.push(...plan.notes.map((note) => `- ${note}`));
  }

  if (options.installSchedule) {
    const intervalMinutes =
      plan.scheduleIntervalMinutes ?? effectiveConfig.schedule.intervalMinutes;

    const schedule = await installLaunchdSchedule({
      configPath,
      intervalMinutes,
      cliEntrypoint: resolveCliEntrypoint(import.meta.url),
      label: options.label,
      ...(options.launchAgentsDir ? { launchAgentsDir: resolvePath(options.launchAgentsDir) } : {}),
      ...(options.logsDir ? { logsDir: resolvePath(options.logsDir) } : {}),
      force: options.forceSchedule === true,
      load: options.load !== false,
    });
    lines.push(`LaunchAgent: ${schedule.plistPath}`);
  }

  if (options.update) {
    const updateResult = await runUpdate({
      config: effectiveConfig,
      ...(options.subscriptionFile ? { subscriptionFile: options.subscriptionFile } : {}),
      ...(options.subscriptionUrl ? { subscriptionUrl: options.subscriptionUrl } : {}),
      ...(options.livePath ? { livePath: resolvePath(options.livePath) } : {}),
      ...(options.backupPath ? { backupPath: resolvePath(options.backupPath) } : {}),
      ...(options.singBoxBin ? { singBoxBinary: resolvePath(options.singBoxBin) } : {}),
      ...(options.chromeBin ? { chromeBinary: resolvePath(options.chromeBin) } : {}),
      verify: !options.skipVerify,
      ...(options.reload ? { reload: true } : {}),
    });
    lines.push(`Staging: ${updateResult.build.outputPath}`);
    lines.push(
      updateResult.verification
        ? `Verified scenarios: ${
            updateResult.verification.scenarios.filter((scenario) => scenario.passed).length
          }/${updateResult.verification.scenarios.length}`
        : "Verified scenarios: skipped",
    );
    lines.push(`Live: ${updateResult.livePath}`);
    if (updateResult.backupPath) {
      lines.push(`Backup: ${updateResult.backupPath}`);
    }
    lines.push(`Reload: ${updateResult.reloaded ? "triggered" : "skipped"}`);
  } else if (!options.skipBuild) {
    const build = await buildConfigArtifact({
      config: effectiveConfig,
      ...(options.subscriptionFile ? { subscriptionFile: options.subscriptionFile } : {}),
      ...(options.subscriptionUrl ? { subscriptionUrl: options.subscriptionUrl } : {}),
    });
    lines.push(`Staging: ${build.outputPath}`);
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

interface AuthorCommandOptions {
  readonly prompt: string;
  readonly config?: string;
  readonly provider?: "deterministic" | "auto" | "claude" | "exec";
  readonly authorTimeoutMs?: string;
  readonly execCommand?: string;
  readonly execArg: string[];
  readonly rulesOut?: string;
  readonly subscriptionUrl?: string;
  readonly subscriptionFile?: string;
  readonly preview?: boolean;
  readonly diff?: boolean;
  readonly emitIntentIr?: boolean;
  readonly strict?: boolean;
  readonly skipBuild?: boolean;
  readonly update?: boolean;
  readonly skipVerify?: boolean;
  readonly reload?: boolean;
  readonly livePath?: string;
  readonly backupPath?: string;
  readonly singBoxBin?: string;
  readonly chromeBin?: string;
  readonly installSchedule?: boolean;
  readonly label: string;
  readonly launchAgentsDir?: string;
  readonly logsDir?: string;
  readonly forceSchedule?: boolean;
  readonly load?: boolean;
}

function resolvePath(filePath: string): string {
  return filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
}

function collectOption(value: string, previous: readonly string[]): string[] {
  return [...previous, value];
}
