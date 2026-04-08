import path from "node:path";

import type { Command } from "commander";

import { collectDiagnosticsReport } from "../../modules/diagnostics/index.js";
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

      const lines = [
        `Generated: ${report.generatedAt}`,
        ...(report.builderConfigPath ? [`Config: ${report.builderConfigPath}`] : []),
        `Summary: PASS ${report.summary.pass} WARN ${report.summary.warn} FAIL ${report.summary.fail}`,
        "Checks:",
        ...report.checks.map((check) => `- [${check.status}] ${check.name}: ${check.details}`),
        "Status diagnostics:",
        ...(report.status.diagnostics.length > 0
          ? report.status.diagnostics.map(
              (diagnostic) => `- [${diagnostic.level}] ${diagnostic.message}`,
            )
          : ["- [info] No status diagnostics were recorded."]),
      ];

      process.stdout.write(`${lines.join("\n")}\n`);
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
