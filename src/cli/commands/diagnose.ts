import path from "node:path";

import type { Command } from "commander";

import {
  type DiagnosticsCheck,
  type DiagnosticsReport,
  collectDiagnosticsReport,
} from "../../modules/diagnostics/index.js";
import { findDefaultConfigPath, resolveBuilderConfig } from "../command-helpers.js";

export function registerDiagnoseCommand(program: Command): void {
  program
    .command("diagnose")
    .description("Summarize runtime, proxy, DNS, and local-network evidence.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--launch-agents-dir <path>", "override LaunchAgents directory")
    .option("--json", "print machine-readable JSON")
    .action(async (options: DiagnoseCommandOptions) => {
      const config = await resolveBuilderConfig(options);
      const configPath = options.config
        ? resolvePath(options.config)
        : await findDefaultConfigPath();
      const report = await collectDiagnosticsReport({
        ...(config ? { config } : {}),
        ...(configPath ? { configPath } : {}),
        ...(options.singBoxBin ? { singBoxBinary: resolvePath(options.singBoxBin) } : {}),
        ...(options.launchAgentsDir
          ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
          : {}),
      });

      if (options.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return;
      }

      process.stdout.write(renderDiagnoseOutput(report));
    });
}

interface DiagnoseCommandOptions {
  readonly config?: string;
  readonly singBoxBin?: string;
  readonly launchAgentsDir?: string;
  readonly json?: boolean;
}

function resolvePath(filePath: string): string {
  return filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
}

function renderDiagnoseOutput(report: DiagnosticsReport): string {
  const assessment = assessDiagnostics(report);
  const lines = [
    "Network triage: runtime summary plus local route, DNS, and domain-resolution evidence.",
    "",
    ...renderSection("Context", [
      `generated: ${report.generatedAt}`,
      `config: ${report.builderConfigPath ?? "(missing)"}`,
    ]),
    "",
    ...renderSection("Summary", [
      `checks: PASS ${report.summary.pass} WARN ${report.summary.warn} FAIL ${report.summary.fail}`,
      `assessment: ${assessment.label}`,
    ]),
    "",
    ...renderSection(
      "Runtime Summary",
      selectChecks(report.checks, "runtime").map(formatCheckLine),
    ),
    "",
    ...renderSection(
      "Network Evidence",
      selectChecks(report.checks, "network").map(formatCheckLine),
    ),
    "",
    ...renderSection("Suggested Next Step", assessment.nextSteps),
    "",
    ...renderSection(
      "Status Diagnostics",
      report.status.diagnostics.length > 0
        ? report.status.diagnostics.map(
            (diagnostic) => `[${diagnostic.level}] ${diagnostic.message}`,
          )
        : ["[info] No status diagnostics were recorded."],
    ),
  ];

  return `${lines.join("\n")}\n`;
}

function assessDiagnostics(report: DiagnosticsReport): {
  readonly label: string;
  readonly nextSteps: readonly string[];
} {
  const runtimeChecks = selectChecks(report.checks, "runtime");
  const networkChecks = selectChecks(report.checks, "network");
  const runtimeHasWarnings =
    runtimeChecks.some((check) => check.status !== "PASS") ||
    report.status.diagnostics.some((diagnostic) => diagnostic.level !== "info");
  const networkHasWarnings = networkChecks.some((check) => check.status !== "PASS");

  if (report.summary.warn === 0 && report.summary.fail === 0) {
    return {
      label: "No immediate network issue detected.",
      nextSteps: [
        "No immediate action. If a specific app still fails, compare app-specific routing and re-run diagnose.",
      ],
    };
  }

  if (runtimeHasWarnings && !networkHasWarnings) {
    return {
      label: "Likely runtime drift or publish issue.",
      nextSteps: [
        report.status.runtime.systemProxy?.nextAction ??
          "Reconcile runtime state first: run `singbox-iac status` or `singbox-iac restart`, then re-run diagnose.",
      ],
    };
  }

  if (!runtimeHasWarnings && networkHasWarnings) {
    return {
      label: "Likely local DNS / route issue.",
      nextSteps: ["Inspect local DNS, router, VPN, or captive-portal state, then re-run diagnose."],
    };
  }

  return {
    label: "Mixed evidence across runtime and local network.",
    nextSteps: [
      report.status.runtime.systemProxy?.nextAction ??
        "Fix runtime drift first, then re-run diagnose to see whether local DNS or route warnings remain.",
      "If network warnings remain after the runtime is healthy, inspect local DNS, route, VPN, or captive-portal state.",
    ],
  };
}

function selectChecks(
  checks: readonly DiagnosticsCheck[],
  scope: "runtime" | "network",
): readonly DiagnosticsCheck[] {
  return checks.filter((check) =>
    scope === "runtime" ? isRuntimeCheck(check.name) : isNetworkCheck(check.name),
  );
}

function isRuntimeCheck(name: string): boolean {
  return (
    name === "runtime-process" ||
    name.startsWith("listener:") ||
    name === "system-proxy" ||
    name === "live-config" ||
    name === "schedule" ||
    name === "latest-transaction"
  );
}

function isNetworkCheck(name: string): boolean {
  return name === "default-route" || name === "system-dns" || name.startsWith("dns-probe:");
}

function formatCheckLine(check: DiagnosticsCheck): string {
  return `[${check.status}] ${check.name}: ${check.details}`;
}

function renderSection(title: string, items: readonly string[]): string[] {
  return [`${title}:`, ...(items.length > 0 ? items.map((item) => `- ${item}`) : ["- (none)"])];
}
