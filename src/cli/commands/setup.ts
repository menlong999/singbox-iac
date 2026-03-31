import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/load-config.js";
import { generateAuthoringPlan } from "../../modules/authoring/index.js";
import { buildConfigArtifact } from "../../modules/build/index.js";
import { initWorkspace } from "../../modules/init/index.js";
import {
  applyPlanToBuilderConfig,
  updateBuilderAuthoring,
  writeGeneratedRules,
} from "../../modules/natural-language/index.js";
import { syncLocalRuleSets } from "../../modules/rule-set-sync/index.js";
import { installLaunchdSchedule } from "../../modules/schedule/index.js";
import {
  getDefaultConfigPath,
  getDefaultRulesPath,
  resolveCliEntrypoint,
  resolvePackageRoot,
} from "../command-helpers.js";

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description(
      "One-step setup: initialize config, sync rule sets, optionally author rules, and build.",
    )
    .option("-c, --config <path>", "path to builder config YAML", getDefaultConfigPath())
    .option(
      "--rules-out <path>",
      "target custom-rules file for first-time setup",
      getDefaultRulesPath(),
    )
    .option("--subscription-url <url>", "subscription URL; required on first setup")
    .option("--subscription-file <path>", "use a local subscription file for the initial build")
    .option("-p, --prompt <text>", "optional natural-language routing prompt")
    .option("--provider <provider>", "authoring provider: deterministic, auto, claude, exec")
    .option("--author-timeout-ms <ms>", "timeout for local AI CLI authoring")
    .option("--exec-command <command>", "command for the exec authoring provider")
    .option(
      "--exec-arg <arg>",
      "append one argument for the exec authoring provider",
      collectOption,
      [],
    )
    .option("--skip-rulesets", "skip syncing the configured local rule sets")
    .option("--skip-build", "create/update configuration only and skip the initial build")
    .option("--install-schedule", "install a launchd job after setup")
    .option("--label <label>", "LaunchAgent label", "org.singbox-iac.update")
    .option("--launch-agents-dir <path>", "override LaunchAgents directory")
    .option("--logs-dir <path>", "override launchd log directory")
    .option(
      "-f, --force",
      "overwrite generated files during first-time setup and re-download rulesets",
    )
    .option("--no-load", "write the LaunchAgent without calling launchctl bootstrap")
    .action(async (options: SetupCommandOptions) => {
      const configPath = resolvePath(options.config);
      const rulesPath = resolvePath(options.rulesOut);
      const createdFreshConfig = options.force === true || !(await pathExists(configPath));

      if (createdFreshConfig) {
        if (!options.subscriptionUrl) {
          throw new Error(
            "setup needs --subscription-url the first time. Existing configs can omit it.",
          );
        }

        await initWorkspace({
          configOutPath: configPath,
          rulesOutPath: rulesPath,
          examplesDir: path.join(resolvePackageRoot(import.meta.url), "examples"),
          subscriptionUrl: options.subscriptionUrl,
          force: options.force === true,
        });
      }

      let builderConfig = await loadConfig(configPath);

      if (!createdFreshConfig && options.subscriptionUrl) {
        await updateBuilderAuthoring({
          configPath,
          subscriptionUrl: options.subscriptionUrl,
        });
        builderConfig = await loadConfig(configPath);
      }

      let effectiveConfig = builderConfig;
      let planSummary:
        | {
            providerRequested: string;
            providerUsed: string;
            templates: readonly string[];
            generatedRules: number;
            notes: readonly string[];
          }
        | undefined;

      if (options.prompt) {
        const planResult = await generateAuthoringPlan({
          prompt: options.prompt,
          config: builderConfig,
          ...(options.provider ? { provider: options.provider } : {}),
          ...(options.authorTimeoutMs
            ? { timeoutMs: Number.parseInt(options.authorTimeoutMs, 10) }
            : {}),
          ...(options.execCommand ? { execCommand: options.execCommand } : {}),
          ...(options.execArg.length > 0 ? { execArgs: options.execArg } : {}),
        });

        effectiveConfig = applyPlanToBuilderConfig(builderConfig, {
          rulesPath: builderConfig.rules.userRulesFile,
          plan: planResult.plan,
        });

        await writeGeneratedRules({
          filePath: effectiveConfig.rules.userRulesFile,
          plan: planResult.plan,
        });
        await updateBuilderAuthoring({
          configPath,
          rulesPath: effectiveConfig.rules.userRulesFile,
          ...(planResult.plan.scheduleIntervalMinutes
            ? { intervalMinutes: planResult.plan.scheduleIntervalMinutes }
            : {}),
          ...(planResult.plan.groupDefaults
            ? { groupDefaults: planResult.plan.groupDefaults }
            : {}),
          ...(planResult.plan.verificationOverrides
            ? { verificationOverrides: planResult.plan.verificationOverrides }
            : {}),
        });
        builderConfig = await loadConfig(configPath);
        effectiveConfig = builderConfig;
        planSummary = {
          providerRequested: planResult.providerRequested,
          providerUsed: planResult.providerUsed,
          templates: planResult.plan.templateIds,
          generatedRules:
            planResult.plan.beforeBuiltins.length + planResult.plan.afterBuiltins.length,
          notes: planResult.plan.notes,
        };
      }

      const lines = [`Config: ${configPath}`, `Rules: ${effectiveConfig.rules.userRulesFile}`];

      if (options.skipRulesets) {
        lines.push("Rule sets: skipped");
      } else {
        const syncResult = await syncLocalRuleSets({
          ruleSets: effectiveConfig.ruleSets,
          force: options.force === true,
        });
        lines.push(
          `Rule sets: downloaded ${syncResult.downloaded.length}, skipped ${syncResult.skipped.length}, failed ${syncResult.failed.length}`,
        );
        if (syncResult.failed.length > 0) {
          lines.push(...syncResult.failed.map((failure) => `- ${failure.tag}: ${failure.reason}`));
        }
      }

      if (planSummary) {
        lines.push(`Provider requested: ${planSummary.providerRequested}`);
        lines.push(`Provider used: ${planSummary.providerUsed}`);
        lines.push(
          `Templates: ${planSummary.templates.length > 0 ? planSummary.templates.join(", ") : "(none)"}`,
        );
        lines.push(`Generated rules: ${planSummary.generatedRules}`);
        if (planSummary.notes.length > 0) {
          lines.push(...planSummary.notes.map((note) => `- ${note}`));
        }
      }

      if (options.installSchedule) {
        const schedule = await installLaunchdSchedule({
          configPath,
          intervalMinutes: effectiveConfig.schedule.intervalMinutes,
          cliEntrypoint: resolveCliEntrypoint(import.meta.url),
          label: options.label,
          ...(options.launchAgentsDir
            ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
            : {}),
          ...(options.logsDir ? { logsDir: resolvePath(options.logsDir) } : {}),
          force: options.force === true,
          load: options.load !== false,
        });
        lines.push(`LaunchAgent: ${schedule.plistPath}`);
      }

      if (options.skipBuild) {
        lines.push("Staging: skipped");
      } else {
        const build = await buildConfigArtifact({
          config: effectiveConfig,
          ...(options.subscriptionFile
            ? { subscriptionFile: resolvePath(options.subscriptionFile) }
            : {}),
          ...(options.subscriptionUrl ? { subscriptionUrl: options.subscriptionUrl } : {}),
        });
        lines.push(`Staging: ${build.outputPath}`);
        lines.push(`Nodes: ${build.nodeCount}`);
      }

      lines.push(
        `Proxy ports: mixed ${effectiveConfig.listeners.mixed.listen}:${effectiveConfig.listeners.mixed.port}, proxifier ${effectiveConfig.listeners.proxifier.listen}:${effectiveConfig.listeners.proxifier.port}`,
      );
      lines.push("Next: singbox-iac run");
      lines.push("Next: singbox-iac update --reload");

      process.stdout.write(`${lines.join("\n")}\n`);
    });
}

interface SetupCommandOptions {
  readonly config: string;
  readonly rulesOut: string;
  readonly subscriptionUrl?: string;
  readonly subscriptionFile?: string;
  readonly prompt?: string;
  readonly provider?: "deterministic" | "auto" | "claude" | "exec";
  readonly authorTimeoutMs?: string;
  readonly execCommand?: string;
  readonly execArg: string[];
  readonly skipRulesets?: boolean;
  readonly skipBuild?: boolean;
  readonly installSchedule?: boolean;
  readonly label: string;
  readonly launchAgentsDir?: string;
  readonly logsDir?: string;
  readonly force?: boolean;
  readonly load?: boolean;
}

function resolvePath(filePath: string): string {
  return filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
}

function collectOption(value: string, previous: readonly string[]): string[] {
  return [...previous, value];
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
