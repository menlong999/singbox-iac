import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/load-config.js";
import { generateAuthoringPlan } from "../../modules/authoring/index.js";
import { buildConfigArtifact, resolveEffectiveIntent } from "../../modules/build/index.js";
import { runDoctor } from "../../modules/doctor/index.js";
import { initWorkspace } from "../../modules/init/index.js";
import { applyConfig, checkConfig, resolveSingBoxBinary } from "../../modules/manager/index.js";
import {
  applyPlanToBuilderConfig,
  selectVerificationScenariosForPrompt,
  updateBuilderAuthoring,
  writeGeneratedRules,
} from "../../modules/natural-language/index.js";
import {
  selectProxifierBundlesFromPrompt,
  writeProxifierScaffold,
} from "../../modules/proxifier/index.js";
import { syncLocalRuleSets } from "../../modules/rule-set-sync/index.js";
import {
  getRuntimeModeDefaults,
  inferRuntimeMode,
  selectVerificationScenariosForRuntimeMode,
} from "../../modules/runtime-mode/index.js";
import { installLaunchdSchedule } from "../../modules/schedule/index.js";
import {
  type VerificationReport,
  assertVerificationReportPassed,
  openVisibleChromeWindows,
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
    .option("--run", "run sing-box in the foreground after setup completes")
    .option("--open-browser", "open isolated Chrome windows for prompt-relevant verification URLs")
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
    .option("--proxifier-out-dir <path>", "write Proxifier helper files for process-aware routing")
    .option(
      "-f, --force",
      "overwrite generated files during first-time setup and re-download rulesets",
    )
    .option("--no-load", "write the LaunchAgent without calling launchctl bootstrap")
    .action(async (options: SetupCommandOptions) => {
      await runSetupFlow(options);
    });
}

export async function runSetupFlow(options: SetupCommandOptions): Promise<void> {
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
  let proxifierSummary:
    | {
        guidePath: string;
        bundleIds: readonly string[];
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
      ...(planResult.plan.groupDefaults ? { groupDefaults: planResult.plan.groupDefaults } : {}),
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
      generatedRules: planResult.plan.beforeBuiltins.length + planResult.plan.afterBuiltins.length,
      notes: planResult.plan.notes,
    };
  }

  const lines = [`Config: ${configPath}`, `Rules: ${effectiveConfig.rules.userRulesFile}`];
  const shouldDoctor = options.doctor !== false || options.ready === true;
  const shouldVerify = options.verify === true || options.ready === true;
  const shouldApply = options.apply === true || options.ready === true;
  const shouldInstallSchedule = options.installSchedule === true || options.ready === true;
  const shouldRun = options.run === true;

  if (options.skipBuild && (shouldVerify || shouldApply)) {
    throw new Error("setup cannot use --skip-build together with --verify or --apply.");
  }
  if (options.skipBuild && shouldRun) {
    throw new Error("setup cannot use --skip-build together with --run.");
  }

  if (options.skipRulesets) {
    lines.push("Rule sets: skipped");
  } else {
    const syncResult = await syncLocalRuleSets({
      ruleSets: effectiveConfig.ruleSets,
      force: options.force === true,
      timeoutMs: 15000,
      onProgress: (event) => {
        if (event.phase === "start") {
          process.stdout.write(
            `Rule set ${event.index}/${event.total}: downloading ${event.tag}\n`,
          );
          return;
        }

        if (event.phase === "downloaded") {
          process.stdout.write(`Rule set ${event.index}/${event.total}: saved ${event.tag}\n`);
          return;
        }

        if (event.phase === "bundled") {
          process.stdout.write(`Rule set ${event.index}/${event.total}: bundled ${event.tag}\n`);
          return;
        }

        if (event.phase === "skipped") {
          process.stdout.write(`Rule set ${event.index}/${event.total}: cached ${event.tag}\n`);
          return;
        }

        process.stdout.write(
          `Rule set ${event.index}/${event.total}: failed ${event.tag} (${event.reason ?? "unknown error"})\n`,
        );
      },
    });
    lines.push(
      `Rule sets: downloaded ${syncResult.downloaded.length}, skipped ${syncResult.skipped.length}, failed ${syncResult.failed.length}`,
    );
    if (syncResult.failed.length > 0) {
      lines.push(...syncResult.failed.map((failure) => `- ${failure.tag}: ${failure.reason}`));
    }
  }

  if (shouldDoctor) {
    const doctorReport = await runDoctor({
      config: effectiveConfig,
      configPath,
      ...(options.singBoxBin ? { singBoxBinary: resolvePath(options.singBoxBin) } : {}),
      ...(options.chromeBin ? { chromeBinary: resolvePath(options.chromeBin) } : {}),
      ...(options.launchAgentsDir ? { launchAgentsDir: resolvePath(options.launchAgentsDir) } : {}),
    });
    lines.push(...formatDoctorSummary(doctorReport));
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

  const selectedProxifierBundles = options.prompt
    ? selectProxifierBundlesFromPrompt(options.prompt)
    : [];
  const effectiveIntent = await resolveEffectiveIntent(effectiveConfig);
  const runtimeMode = inferRuntimeMode({
    phase: "onboarding",
    intent: effectiveIntent,
    config: effectiveConfig,
    proxifierBundleIds: selectedProxifierBundles,
    runInForeground: shouldRun,
    ...(options.prompt ? { prompt: options.prompt } : {}),
  });
  const runtimeModeDefaults = getRuntimeModeDefaults(runtimeMode);
  const shouldOpenBrowser =
    options.openBrowser === true ||
    (options.openBrowser === undefined &&
      options.ready === true &&
      options.run === true &&
      runtimeModeDefaults.openVisibleBrowserByDefault);

  lines.push(`Runtime mode: ${runtimeMode}`);
  lines.push(`Runtime DNS mode: ${runtimeModeDefaults.dnsMode}`);
  lines.push(
    `Runtime listeners: ${runtimeModeDefaults.preferredListeners.map((entry) => `in-${entry}`).join(", ")}`,
  );
  lines.push(`Schedule recommended: ${runtimeModeDefaults.scheduleRecommended ? "yes" : "no"}`);

  if (options.proxifierOutDir || selectedProxifierBundles.length > 0) {
    const proxifierOutputDir = resolvePath(
      options.proxifierOutDir ?? path.join(path.dirname(configPath), "proxifier"),
    );
    const scaffold = await writeProxifierScaffold({
      listener: {
        host: effectiveConfig.listeners.proxifier.listen,
        port: effectiveConfig.listeners.proxifier.port,
      },
      outputDir: proxifierOutputDir,
      ...(selectedProxifierBundles.length > 0 ? { bundleIds: selectedProxifierBundles } : {}),
    });
    proxifierSummary = {
      guidePath: scaffold.guidePath,
      bundleIds: scaffold.bundles.map((bundle) => bundle.id),
    };
  }

  if (proxifierSummary) {
    lines.push(`Proxifier guide: ${proxifierSummary.guidePath}`);
    lines.push(
      `Proxifier bundles: ${
        proxifierSummary.bundleIds.length > 0
          ? proxifierSummary.bundleIds.join(", ")
          : "(manual custom-processes.txt)"
      }`,
    );
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
      ...(options.launchAgentsDir ? { launchAgentsDir: resolvePath(options.launchAgentsDir) } : {}),
      ...(options.logsDir ? { logsDir: resolvePath(options.logsDir) } : {}),
      ...(options.singBoxBin ? { singBoxBinary: resolvePath(options.singBoxBin) } : {}),
      ...(options.chromeBin ? { chromeBinary: resolvePath(options.chromeBin) } : {}),
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

  if (!shouldRun || !buildSummary) {
    return;
  }

  const runConfigPath = shouldApply ? effectiveConfig.output.livePath : buildSummary.outputPath;
  const singBoxBinary = await resolveSingBoxBinary(
    options.singBoxBin ? resolvePath(options.singBoxBin) : undefined,
  );

  await checkConfig({
    configPath: runConfigPath,
    singBoxBinary,
  });

  const child = spawn(singBoxBinary, ["run", "-c", runConfigPath], {
    stdio: "inherit",
  });

  try {
    await waitForPorts(
      [
        {
          host: effectiveConfig.listeners.mixed.listen,
          port: effectiveConfig.listeners.mixed.port,
        },
        {
          host: effectiveConfig.listeners.proxifier.listen,
          port: effectiveConfig.listeners.proxifier.port,
        },
      ],
      15_000,
    );

    if (shouldOpenBrowser) {
      const runtimeScenarios = selectVerificationScenariosForRuntimeMode(
        runtimeMode,
        effectiveConfig.verification.scenarios,
      );
      const selectedScenarios = options.prompt
        ? selectVerificationScenariosForPrompt(options.prompt, runtimeScenarios)
        : runtimeScenarios.slice(
            0,
            Math.min(runtimeModeDefaults.visibleBrowserScenarioLimit, runtimeScenarios.length),
          );

      const visibleScenarios = selectedScenarios.map((scenario) => ({
        id: scenario.id,
        name: scenario.name,
        url: scenario.url,
        inbound: scenario.inbound,
      }));
      const launches = await openVisibleChromeWindows({
        scenarios: visibleScenarios,
        mixedPort: effectiveConfig.listeners.mixed.port,
        proxifierPort: effectiveConfig.listeners.proxifier.port,
        ...(options.chromeBin ? { chromeBinary: resolvePath(options.chromeBin) } : {}),
      });

      process.stdout.write(
        `${launches
          .map(
            (launch) =>
              `Opened Chrome for ${launch.inbound} on ${launch.urls.join(", ")} via 127.0.0.1:${launch.proxyPort}`,
          )
          .join("\n")}\n`,
      );
    }

    process.stdout.write(`Running sing-box in foreground: ${runConfigPath}\n`);

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 0));
    });
    process.exitCode = exitCode;
  } finally {
    if (!child.killed && child.exitCode === null) {
      child.kill("SIGINT");
    }
  }
}

export interface SetupCommandOptions {
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
  readonly run?: boolean;
  readonly openBrowser?: boolean;
  readonly ready?: boolean;
  readonly singBoxBin?: string;
  readonly chromeBin?: string;
  readonly installSchedule?: boolean;
  readonly label: string;
  readonly launchAgentsDir?: string;
  readonly logsDir?: string;
  readonly proxifierOutDir?: string;
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

async function waitForPorts(
  ports: ReadonlyArray<{
    host: string;
    port: number;
  }>,
  timeoutMs: number,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const allReady = await Promise.all(ports.map((entry) => isTcpPortOpen(entry.host, entry.port)));
    if (allReady.every(Boolean)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Timed out waiting for local listeners: ${ports
      .map((entry) => `${entry.host}:${entry.port}`)
      .join(", ")}`,
  );
}

async function isTcpPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(500);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
}
