import type { Command } from "commander";

import { runUpdate } from "../../modules/update/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerUpdateCommand(program: Command): void {
  const command = program
    .command("update")
    .description("Refresh subscription, verify, publish, and auto-reload if sing-box is running.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--subscription-url <url>", "override subscription URL when rebuilding")
    .option("--subscription-file <path>", "use a local subscription file instead of fetching")
    .option("-o, --output <path>", "override staging output path")
    .option("--live-path <path>", "override live config path")
    .option("--backup-path <path>", "override backup config path")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--chrome-bin <path>", "path to Chrome binary")
    .option("--skip-verify", "skip the runtime verification harness before publish")
    .option("--reload", "reload sing-box after publish")
    .action(async (options: UpdateCommandOptions) => {
      const builderConfig = await resolveBuilderConfig(options);
      if (!builderConfig) {
        throw new Error(
          "Update requires a builder config. Pass --config or create builder.config.local.yaml.",
        );
      }

      const result = await runUpdate({
        config: builderConfig,
        ...(options.output ? { outputPath: options.output } : {}),
        ...(options.livePath ? { livePath: options.livePath } : {}),
        ...(options.backupPath ? { backupPath: options.backupPath } : {}),
        ...(options.subscriptionFile ? { subscriptionFile: options.subscriptionFile } : {}),
        ...(options.subscriptionUrl ? { subscriptionUrl: options.subscriptionUrl } : {}),
        ...(options.singBoxBin ? { singBoxBinary: options.singBoxBin } : {}),
        ...(options.chromeBin ? { chromeBinary: options.chromeBin } : {}),
        verify: !options.skipVerify,
        ...(options.reload ? { reload: true } : {}),
      });

      const verificationSummary = result.verification
        ? `Verified scenarios: ${
            result.verification.scenarios.filter((scenario) => scenario.passed).length
          }/${result.verification.scenarios.length}`
        : "Verified scenarios: skipped";

      process.stdout.write(
        `${[
          `Generated ${result.build.nodeCount} nodes.`,
          `Staging: ${result.build.outputPath}`,
          verificationSummary,
          `Live: ${result.livePath}`,
          result.backupPath ? `Backup: ${result.backupPath}` : undefined,
          `Reload: ${result.reloaded ? "triggered" : "skipped"}`,
          `Warnings: ${result.build.warnings.length}`,
        ]
          .filter((line): line is string => typeof line === "string")
          .join("\n")}\n`,
      );

      if (result.build.warnings.length > 0) {
        process.stdout.write(
          `${result.build.warnings.map((warning) => `- ${warning}`).join("\n")}\n`,
        );
      }
    });

  for (const optionName of [
    "subscriptionUrl",
    "subscriptionFile",
    "output",
    "livePath",
    "backupPath",
    "singBoxBin",
    "chromeBin",
    "skipVerify",
    "reload",
  ]) {
    command.options.find((entry) => entry.attributeName() === optionName)?.hideHelp();
  }
}

interface UpdateCommandOptions {
  readonly config?: string;
  readonly subscriptionUrl?: string;
  readonly subscriptionFile?: string;
  readonly output?: string;
  readonly livePath?: string;
  readonly backupPath?: string;
  readonly singBoxBin?: string;
  readonly chromeBin?: string;
  readonly skipVerify?: boolean;
  readonly reload?: boolean;
}
