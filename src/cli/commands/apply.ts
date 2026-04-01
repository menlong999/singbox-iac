import type { Command } from "commander";

import { applyConfig } from "../../modules/manager/index.js";
import { applyWithTransaction } from "../../modules/transactions/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerApplyCommand(program: Command): void {
  program
    .command("apply")
    .description("Validate and publish the latest generated config.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("-i, --input <path>", "path to staging config JSON")
    .option("--live-path <path>", "override live config path")
    .option("--backup-path <path>", "override backup config path")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--reload", "reload sing-box after publish")
    .action(async (options: ApplyCommandOptions) => {
      const builderConfig = await resolveBuilderConfig(options);
      const stagingPath = options.input ?? builderConfig?.output.stagingPath;
      const livePath = options.livePath ?? builderConfig?.output.livePath;
      const backupPath = options.backupPath ?? builderConfig?.output.backupPath;

      if (!stagingPath || !livePath) {
        throw new Error(
          "Unable to resolve staging/live paths. Pass --input/--live-path or provide a builder config.",
        );
      }

      const transaction = builderConfig
        ? await applyWithTransaction({
            config: builderConfig,
            generatedPath: stagingPath,
            livePath,
            backupPath: backupPath ?? builderConfig.output.backupPath,
            verificationSummary: {},
            apply: async () => {
              await applyConfig({
                stagingPath,
                livePath,
                ...(backupPath ? { backupPath } : {}),
                ...(options.singBoxBin ? { singBoxBinary: options.singBoxBin } : {}),
                ...(options.reload !== undefined ? { reload: options.reload } : {}),
                ...(builderConfig?.runtime.reload ? { runtime: builderConfig.runtime.reload } : {}),
              });
            },
          })
        : undefined;

      process.stdout.write(
        `Applied config.\nSource: ${stagingPath}\nLive: ${livePath}\n${
          backupPath ? `Backup: ${backupPath}\n` : ""
        }${transaction ? `Transaction: ${transaction.txId}\n` : ""}`,
      );
    });
}

interface ApplyCommandOptions {
  readonly config?: string;
  readonly input?: string;
  readonly livePath?: string;
  readonly backupPath?: string;
  readonly singBoxBin?: string;
  readonly reload?: boolean;
}
