import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/load-config.js";
import type { IntentIR, IntentSitePolicy } from "../../domain/intent.js";
import { generateAuthoringPlan } from "../../modules/authoring/index.js";
import { buildConfigArtifact, resolveEffectiveIntent } from "../../modules/build/index.js";
import { updateBuilderDesktopRuntime } from "../../modules/desktop-runtime/index.js";
import { runDoctor } from "../../modules/doctor/index.js";
import { initWorkspace } from "../../modules/init/index.js";
import {
  applyLayeredAuthoringUpdate,
  materializeLayeredAuthoringState,
  resolveLayeredAuthoringPath,
  resolveLayeredAuthoringState,
  writeLayeredAuthoringState,
} from "../../modules/layered-authoring/index.js";
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
import { persistRuntimeDependencies } from "../../modules/runtime-dependencies/index.js";
import {
  getRuntimeModeDefaults,
  inferDesktopRuntimeProfile,
  inferRuntimeMode,
  selectVerificationScenariosForRuntimeMode,
} from "../../modules/runtime-mode/index.js";
import { installLaunchdSchedule } from "../../modules/schedule/index.js";
import {
  type VerificationReport,
  type VerificationScenarioResult,
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
      preserveExistingRules: true,
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
        intent: IntentIR;
        ambiguities: readonly string[];
        groupDefaults: Record<string, unknown>;
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
    const currentLayeredState = await resolveLayeredAuthoringState({
      config: builderConfig,
    });
    const nextLayeredState = applyLayeredAuthoringUpdate({
      current: currentLayeredState.state,
      prompt: options.prompt,
      plan: planResult.plan,
      mode: "replace",
      appliedAt: new Date().toISOString(),
    });
    const nextResolvedLayeredState = materializeLayeredAuthoringState({
      filePath: resolveLayeredAuthoringPath(builderConfig.rules.userRulesFile),
      exists: true,
      state: nextLayeredState,
    });

    effectiveConfig = applyPlanToBuilderConfig(builderConfig, {
      rulesPath: builderConfig.rules.userRulesFile,
      plan: nextResolvedLayeredState.mergedPlan,
    });

    await writeGeneratedRules({
      filePath: effectiveConfig.rules.userRulesFile,
      plan: nextResolvedLayeredState.mergedPlan,
    });
    await writeLayeredAuthoringState({
      rulesPath: effectiveConfig.rules.userRulesFile,
      state: nextLayeredState,
    });
    await updateBuilderAuthoring({
      configPath,
      rulesPath: effectiveConfig.rules.userRulesFile,
      ...(nextResolvedLayeredState.mergedPlan.scheduleIntervalMinutes
        ? { intervalMinutes: nextResolvedLayeredState.mergedPlan.scheduleIntervalMinutes }
        : {}),
      ...(nextResolvedLayeredState.mergedPlan.groupDefaults
        ? { groupDefaults: nextResolvedLayeredState.mergedPlan.groupDefaults }
        : {}),
      ...(nextResolvedLayeredState.mergedPlan.verificationOverrides
        ? { verificationOverrides: nextResolvedLayeredState.mergedPlan.verificationOverrides }
        : {}),
    });
    builderConfig = await loadConfig(configPath);
    effectiveConfig = builderConfig;
    planSummary = {
      providerRequested: planResult.providerRequested,
      providerUsed: planResult.providerUsed,
      templates: nextResolvedLayeredState.mergedPlan.templateIds,
      generatedRules:
        nextResolvedLayeredState.mergedPlan.beforeBuiltins.length +
        nextResolvedLayeredState.mergedPlan.afterBuiltins.length,
      notes: nextResolvedLayeredState.mergedPlan.notes,
      intent: nextResolvedLayeredState.mergedIntent,
      ambiguities: planResult.ambiguities,
      groupDefaults: nextResolvedLayeredState.mergedPlan.groupDefaults ?? {},
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
    const persisted = await persistRuntimeDependencies({
      configPath,
      ...(doctorReport.resolvedDependencies.singBox
        ? { singBox: doctorReport.resolvedDependencies.singBox }
        : {}),
      ...(doctorReport.resolvedDependencies.chrome
        ? { chrome: doctorReport.resolvedDependencies.chrome }
        : {}),
    });
    if (persisted) {
      builderConfig = await loadConfig(configPath);
      effectiveConfig = builderConfig;
    }
    lines.push(...formatDoctorSummary(doctorReport));
  }

  if (planSummary) {
    lines.push(...formatIntentSummary(planSummary));
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
  const desktopRuntimeProfile = inferDesktopRuntimeProfile({
    mode: runtimeMode,
    config: effectiveConfig,
    ...(options.prompt ? { prompt: options.prompt } : {}),
  });
  if (desktopRuntimeProfile !== effectiveConfig.runtime.desktop.profile) {
    await updateBuilderDesktopRuntime({
      configPath,
      profile: desktopRuntimeProfile,
    });
    builderConfig = await loadConfig(configPath);
    effectiveConfig = builderConfig;
  }
  const shouldOpenBrowser =
    options.openBrowser === true ||
    (options.openBrowser === undefined &&
      options.ready === true &&
      options.run === true &&
      runtimeModeDefaults.openVisibleBrowserByDefault);

  lines.push(`Runtime mode: ${runtimeMode}`);
  lines.push(`Desktop runtime profile: ${desktopRuntimeProfile}`);
  lines.push(`Runtime DNS mode: ${runtimeModeDefaults.dnsMode}`);
  lines.push(
    `Runtime listeners: ${runtimeModeDefaults.preferredListeners.map((entry) => `in-${entry}`).join(", ")}`,
  );
  lines.push(`Schedule recommended: ${runtimeModeDefaults.scheduleRecommended ? "yes" : "no"}`);
  if (desktopRuntimeProfile === "tun") {
    lines.push(
      "Desktop caveat: TUN mode depends on local macOS networking privileges and may need additional approval on first start.",
    );
  }

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
        ...(options.singBoxBin
          ? { singBoxBinary: resolvePath(options.singBoxBin) }
          : effectiveConfig.runtime.dependencies.singBoxBinary
            ? { singBoxBinary: effectiveConfig.runtime.dependencies.singBoxBinary }
            : {}),
        ...(options.chromeBin
          ? { chromeBinary: resolvePath(options.chromeBin) }
          : effectiveConfig.runtime.dependencies.chromeBinary
            ? { chromeBinary: effectiveConfig.runtime.dependencies.chromeBinary }
            : {}),
        configuredScenarios: effectiveConfig.verification.scenarios,
      });
      assertVerificationReportPassed(verification);
      lines.push(...formatVerificationSummary(verification));
    }

    if (shouldApply) {
      await applyConfig({
        stagingPath: build.outputPath,
        livePath: effectiveConfig.output.livePath,
        ...(effectiveConfig.output.backupPath
          ? { backupPath: effectiveConfig.output.backupPath }
          : {}),
        ...(options.singBoxBin
          ? { singBoxBinary: resolvePath(options.singBoxBin) }
          : effectiveConfig.runtime.dependencies.singBoxBinary
            ? { singBoxBinary: effectiveConfig.runtime.dependencies.singBoxBinary }
            : {}),
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
      ...(options.singBoxBin
        ? { singBoxBinary: resolvePath(options.singBoxBin) }
        : effectiveConfig.runtime.dependencies.singBoxBinary
          ? { singBoxBinary: effectiveConfig.runtime.dependencies.singBoxBinary }
          : {}),
      ...(options.chromeBin
        ? { chromeBinary: resolvePath(options.chromeBin) }
        : effectiveConfig.runtime.dependencies.chromeBinary
          ? { chromeBinary: effectiveConfig.runtime.dependencies.chromeBinary }
          : {}),
      // Onboarding should be idempotent: refresh the managed LaunchAgent instead of
      // failing when the file already exists from a previous run.
      force: true,
      load: options.load !== false,
    });
    schedulePath = schedule.plistPath;
    lines.push(`LaunchAgent: ${schedule.plistPath}`);
  }

  lines.push(
    `Proxy ports: mixed ${effectiveConfig.listeners.mixed.listen}:${effectiveConfig.listeners.mixed.port}, proxifier ${effectiveConfig.listeners.proxifier.listen}:${effectiveConfig.listeners.proxifier.port}`,
  );
  if (!shouldRun) {
    lines.push("Runtime: not started (--no-run).");
  }
  if (shouldApply) {
    lines.push(
      desktopRuntimeProfile === "none"
        ? "Next: sing-box run -c ~/.config/sing-box/config.json"
        : "Next: singbox-iac start",
    );
    if (schedulePath) {
      lines.push("Schedule: installed and ready for recurring updates");
    } else {
      lines.push("Next: singbox-iac schedule install");
    }
  } else if (buildSummary) {
    lines.push("Next: singbox-iac run");
    lines.push("Next: singbox-iac update --reload");
  }

  process.stdout.write(`${renderCliSummary(lines)}\n`);

  if (!shouldRun || !buildSummary) {
    return;
  }

  const runConfigPath = shouldApply ? effectiveConfig.output.livePath : buildSummary.outputPath;
  const singBoxBinary = await resolveSingBoxBinary(
    options.singBoxBin ? resolvePath(options.singBoxBin) : undefined,
    effectiveConfig.runtime.dependencies.singBoxBinary,
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
        ...(options.chromeBin
          ? { chromeBinary: resolvePath(options.chromeBin) }
          : effectiveConfig.runtime.dependencies.chromeBinary
            ? { chromeBinary: effectiveConfig.runtime.dependencies.chromeBinary }
            : {}),
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

function formatIntentSummary(planSummary: {
  providerRequested: string;
  providerUsed: string;
  templates: readonly string[];
  generatedRules: number;
  notes: readonly string[];
  intent: IntentIR;
  ambiguities: readonly string[];
  groupDefaults: Record<string, unknown>;
}): string[] {
  const lines = [
    `Intent: provider ${planSummary.providerUsed}${planSummary.providerUsed !== planSummary.providerRequested ? ` (requested ${planSummary.providerRequested})` : ""}`,
  ];

  if (planSummary.templates.length > 0) {
    lines.push(`Intent templates: ${planSummary.templates.join(", ")}`);
  }

  const strategyLines = [
    ...formatProcessPolicies(planSummary.intent),
    ...formatSitePolicies(planSummary.intent.sitePolicies),
    ...formatGroupDefaults(planSummary.groupDefaults),
  ];

  if (strategyLines.length > 0) {
    lines.push(`Intent strategies (${strategyLines.length}):`);
    lines.push(...strategyLines.map((line) => `- ${line}`));
  }

  lines.push(`Generated rules: ${planSummary.generatedRules}`);

  if (planSummary.notes.length > 0) {
    lines.push(...planSummary.notes.map((note) => `- ${note}`));
  }

  return lines;
}

function formatProcessPolicies(intent: IntentIR): string[] {
  return intent.processPolicies.map((policy) => {
    const target = formatProcessMatchers(policy.match);
    return `${target} -> ${policy.outboundGroup} via ${policy.inbound}`;
  });
}

function formatProcessMatchers(match: IntentIR["processPolicies"][number]["match"]): string {
  const values = [...(match.processName ?? []), ...(match.bundleId ?? [])];
  if (values.length === 0) {
    return "process flow";
  }
  return values.join(", ");
}

function formatSitePolicies(sitePolicies: readonly IntentSitePolicy[]): string[] {
  return sitePolicies.slice(0, 8).map((policy) => {
    const matcher = describeSiteMatch(policy);
    if (policy.action.type === "reject") {
      return `${matcher} -> reject`;
    }
    return `${matcher} -> ${policy.action.outboundGroup}`;
  });
}

function describeSiteMatch(policy: IntentSitePolicy): string {
  if (policy.match.domainSuffix?.length) {
    return policy.match.domainSuffix.join(", ");
  }
  if (policy.match.domain?.length) {
    return policy.match.domain.join(", ");
  }
  if (policy.match.ruleSet?.length) {
    return `rule-set ${policy.match.ruleSet.join(", ")}`;
  }
  if (policy.match.inbound?.length) {
    return `inbound ${policy.match.inbound.join(", ")}`;
  }
  if (policy.match.protocol) {
    return `protocol ${policy.match.protocol}`;
  }
  return policy.name ?? "generated policy";
}

function formatGroupDefaults(groupDefaults: Record<string, unknown>): string[] {
  const knownGroups = [
    ["processProxy", "default Process-Proxy"],
    ["aiOut", "default AI-Out"],
    ["devCommonOut", "default Dev-Common-Out"],
    ["stitchOut", "default Stitch-Out"],
  ] as const;

  const lines: string[] = [];
  for (const [key, label] of knownGroups) {
    const override = groupDefaults[key];
    if (!override || typeof override !== "object" || Array.isArray(override)) {
      continue;
    }
    const record = override as { defaultTarget?: string; defaultNodePattern?: string };
    if (!record.defaultTarget && !record.defaultNodePattern) {
      continue;
    }
    lines.push(
      `${label} -> ${record.defaultTarget ?? "(unchanged)"}${
        record.defaultNodePattern ? ` (pattern ${record.defaultNodePattern})` : ""
      }`,
    );
  }
  return lines;
}

function formatVerificationSummary(report: VerificationReport): string[] {
  const passed = report.scenarios.filter((scenario) => scenario.passed).length;
  const lines = [`Verified scenarios: ${passed}/${report.scenarios.length}`];
  lines.push(...report.scenarios.map((scenario) => formatVerificationScenario(scenario)));
  return lines;
}

function formatVerificationScenario(scenario: VerificationScenarioResult): string {
  const status = scenario.passed ? "PASS" : "FAIL";
  return `- [${status}] ${scenario.name} -> ${scenario.expectedOutboundTag} via ${scenario.inboundTag}`;
}

function renderCliSummary(lines: readonly string[]): string {
  const ansi = createAnsiStyler();
  return lines
    .map((line) => {
      if (line.startsWith("Config:") || line.startsWith("Rules:")) {
        return ansi.header(line);
      }
      if (line.startsWith("Doctor:")) {
        return ansi.section(line);
      }
      if (line.startsWith("Intent:") || line.startsWith("Intent templates:")) {
        return ansi.section(line);
      }
      if (line.startsWith("Intent strategies") || line.startsWith("Verified scenarios:")) {
        return ansi.section(line);
      }
      if (line.startsWith("- [PASS]")) {
        return ansi.success(line);
      }
      if (line.startsWith("- [WARN]") || line.startsWith("Warnings:")) {
        return ansi.warn(line);
      }
      if (line.startsWith("- [FAIL]")) {
        return ansi.fail(line);
      }
      if (
        line.startsWith("Live:") ||
        line.startsWith("Backup:") ||
        line.startsWith("LaunchAgent:")
      ) {
        return ansi.success(line);
      }
      if (line.startsWith("Runtime: not started")) {
        return ansi.warn(line);
      }
      if (line.startsWith("Next:")) {
        return ansi.info(line);
      }
      return line;
    })
    .join("\n");
}

function createAnsiStyler(): {
  header: (value: string) => string;
  section: (value: string) => string;
  success: (value: string) => string;
  warn: (value: string) => string;
  fail: (value: string) => string;
  info: (value: string) => string;
} {
  const enabled = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

  const wrap = (code: string, value: string): string =>
    enabled ? `\u001B[${code}m${value}\u001B[0m` : value;

  return {
    header: (value) => wrap("1;36", value),
    section: (value) => wrap("1;34", value),
    success: (value) => wrap("32", value),
    warn: (value) => wrap("33", value),
    fail: (value) => wrap("31", value),
    info: (value) => wrap("36", value),
  };
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
