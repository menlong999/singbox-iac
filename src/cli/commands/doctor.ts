import path from "node:path";

import type { Command } from "commander";

import { type DoctorCheck, type DoctorReport, runDoctor } from "../../modules/doctor/index.js";
import { persistRuntimeDependencies } from "../../modules/runtime-dependencies/index.js";
import { findDefaultConfigPath, resolveBuilderConfig } from "../command-helpers.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Inspect environment readiness for singbox-iac.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--chrome-bin <path>", "path to Chrome binary")
    .option("--launch-agents-dir <path>", "override launch agents directory for checks")
    .action(async (options: DoctorCommandOptions) => {
      const [config, configPath] = await Promise.all([
        resolveBuilderConfig(options),
        options.config ? Promise.resolve(pathResolve(options.config)) : findDefaultConfigPath(),
      ]);

      const report = await runDoctor({
        ...(config ? { config } : {}),
        ...(configPath ? { configPath } : {}),
        ...(options.singBoxBin ? { singBoxBinary: options.singBoxBin } : {}),
        ...(options.chromeBin ? { chromeBinary: options.chromeBin } : {}),
        ...(options.launchAgentsDir
          ? { launchAgentsDir: pathResolve(options.launchAgentsDir) }
          : {}),
      });

      if (config && configPath) {
        await persistRuntimeDependencies({
          configPath,
          ...(report.resolvedDependencies.singBox
            ? { singBox: report.resolvedDependencies.singBox }
            : {}),
          ...(report.resolvedDependencies.chrome
            ? { chrome: report.resolvedDependencies.chrome }
            : {}),
        });
      }

      process.stdout.write(renderDoctorOutput(report, configPath));

      if (report.checks.some((check) => check.status === "FAIL")) {
        throw new Error("Doctor found blocking failures.");
      }
    });
}

interface DoctorCommandOptions {
  readonly config?: string;
  readonly singBoxBin?: string;
  readonly chromeBin?: string;
  readonly launchAgentsDir?: string;
}

function pathResolve(filePath: string): string {
  return filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
}

function renderDoctorOutput(report: DoctorReport, configPath?: string): string {
  const lines = [
    "Readiness check: environment and config prerequisites for singbox-iac.",
    "",
    ...renderSection("Context", [`config: ${configPath ?? "(missing)"}`]),
    "",
    ...renderSection(
      "Checks",
      report.checks.map((check) => `[${check.status}] ${check.name}: ${check.details}`),
    ),
    "",
    ...renderSection("Result", [formatDoctorResult(report.checks)]),
  ];

  return `${lines.join("\n")}\n`;
}

function formatDoctorResult(checks: readonly DoctorCheck[]): string {
  return checks.some((check) => check.status === "FAIL")
    ? "blocking-failures: yes"
    : "blocking-failures: no";
}

function renderSection(title: string, items: readonly string[]): string[] {
  return [`${title}:`, ...items.map((item) => `- ${item}`)];
}
