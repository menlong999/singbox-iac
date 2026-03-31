import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/load-config.js";
import { generateAuthoringPlan } from "../../modules/authoring/index.js";
import { buildConfigArtifact } from "../../modules/build/index.js";
import { runDoctor } from "../../modules/doctor/index.js";
import { initWorkspace } from "../../modules/init/index.js";
import { applyConfig } from "../../modules/manager/index.js";
import {
  applyPlanToBuilderConfig,
  updateBuilderAuthoring,
  writeGeneratedRules,
} from "../../modules/natural-language/index.js";
import { syncLocalRuleSets } from "../../modules/rule-set-sync/index.js";
import { installLaunchdSchedule } from "../../modules/schedule/index.js";
import {
  type VerificationReport,
  assertVerificationReportPassed,
  verifyConfigRoutes,
} from "../../modules/verification/index.js";
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
    .option("--no-doctor", "skip environment checks during setup")
    .option("--verify", "run runtime verification after the initial build")
    .option("--apply", "publish the generated config to the configured live path")
    .option("--reload", "reload sing-box after a successful publish")
    .option(
      "--ready",
      "run the guided first-run activation flow: doctor, verify, publish, and install the schedule",
    )
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--chrome-bin <path>", "path to Chrome binary")
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
      const shouldDoctor = options.doctor !== false || options.ready === true;
      const shouldVerify = options.verify === true || options.ready === true;
      const shouldApply = options.apply === true || options.ready === true;
      const shouldInstallSchedule = options.installSchedule === true || options.ready === true;

      if (options.skipBuild && (shouldVerify || shouldApply)) {
        throw new Error("setup cannot use --skip-build together with --verify or --apply.");
      }

      if (shouldDoctor) {
        const doctorReport = await runDoctor({
          config: effectiveConfig,
          configPath,
          ...(options.singBoxBin ? { singBoxBinary: resolvePath(options.singBoxBin) } : {}),
          ...(options.chromeBin ? { chromeBinary: resolvePath(options.chromeBin) } : {}),
          ...(options.launchAgentsDir
            ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
            : {}),
        });
        lines.push(...formatDoctorSummary(doctorReport));
      }

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

      let buildSummary:
        | {
            outputPath: string;
            nodeCount: number;
            verification?: VerificationReport;
          }
        | undefined;

      let schedulePath: string | undefined;

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

        let verification: VerificationReport | undefined;
        if (shouldVerify) {
          verification = await verifyConfigRoutes({
            configPath: build.outputPath,
            ...(options.singBoxBin ? { singBoxBinary: resolvePath(options.singBoxBin) } : {}),
            ...(options.chromeBin ? { chromeBinary: resolvePath(options.chromeBin) } : {}),
            configuredScenarios: effectiveConfig.verification.scenarios,
          });
          assertVerificationReportPassed(verification);
          lines.push(
            `Verified scenarios: ${
              verification.scenarios.filter((scenario) => scenario.passed).length
            }/${verification.scenarios.length}`,
          );
        }

        if (shouldApply) {
          await applyConfig({
            stagingPath: build.outputPath,
            livePath: effectiveConfig.output.livePath,
            ...(effectiveConfig.output.backupPath
              ? { backupPath: effectiveConfig.output.backupPath }
              : {}),
            ...(options.singBoxBin ? { singBoxBinary: resolvePath(options.singBoxBin) } : {}),
            reload: options.reload === true,
            runtime: effectiveConfig.runtime.reload,
          });
          lines.push(`Live: ${effectiveConfig.output.livePath}`);
          if (effectiveConfig.output.backupPath) {
            lines.push(`Backup: ${effectiveConfig.output.backupPath}`);
          }
        }

        buildSummary = {
          outputPath: build.outputPath,
          nodeCount: build.nodeCount,
          ...(verification ? { verification } : {}),
        };
      }

      if (shouldInstallSchedule) {
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
        schedulePath = schedule.plistPath;
        lines.push(`LaunchAgent: ${schedule.plistPath}`);
      }

      lines.push(
        `Proxy ports: mixed ${effectiveConfig.listeners.mixed.listen}:${effectiveConfig.listeners.mixed.port}, proxifier ${effectiveConfig.listeners.proxifier.listen}:${effectiveConfig.listeners.proxifier.port}`,
      );
      if (shouldApply) {
        lines.push("Next: sing-box run -c ~/.config/sing-box/config.json");
        if (schedulePath) {
          lines.push("Schedule: installed and ready for recurring updates");
        } else {
          lines.push("Next: singbox-iac schedule install");
        }
      } else if (buildSummary) {
        lines.push("Next: singbox-iac run");
        lines.push("Next: singbox-iac update --reload");
      }

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
  readonly doctor?: boolean;
  readonly verify?: boolean;
  readonly apply?: boolean;
  readonly reload?: boolean;
  readonly ready?: boolean;
  readonly singBoxBin?: string;
  readonly chromeBin?: string;
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

function formatDoctorSummary(report: Awaited<ReturnType<typeof runDoctor>>): string[] {
  const passCount = report.checks.filter((check) => check.status === "PASS").length;
  const warnCount = report.checks.filter((check) => check.status === "WARN").length;
  const failCount = report.checks.filter((check) => check.status === "FAIL").length;
  const lines = [`Doctor: PASS ${passCount}, WARN ${warnCount}, FAIL ${failCount}`];

  for (const check of report.checks.filter(
    (entry) =>
      entry.status !== "PASS" ||
      entry.name === "sing-box" ||
      entry.name === "chrome" ||
      entry.name === "local-ai-clis",
  )) {
    lines.push(`- [${check.status}] ${check.name}: ${check.details}`);
  }

  return lines;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
