import type { Command } from "commander";

import { reloadRuntime, resolveSingBoxBinary } from "../../modules/manager/index.js";
import { rollbackToPrevious } from "../../modules/transactions/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerRollbackCommand(program: Command): void {
  program
    .command("rollback")
    .description("Rollback the live config to the previous published snapshot.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--to <target>", 'rollback target, currently only "previous"', "previous")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--reload", "reload sing-box after restoring the previous snapshot")
    .action(async (options: RollbackCommandOptions) => {
      if (options.to !== "previous") {
        throw new Error('Only "--to previous" is currently supported.');
      }

      const builderConfig = await resolveBuilderConfig(options);
      if (!builderConfig) {
        throw new Error("rollback requires a builder config.");
      }

      const afterRestore =
        options.reload || options.singBoxBin
          ? async () => {
              await resolveSingBoxBinary(options.singBoxBin);
              if (options.reload) {
                await reloadRuntime({
                  ...(options.singBoxBin ? { singBoxBinary: options.singBoxBin } : {}),
                  runtime: builderConfig.runtime.reload,
                });
              }
            }
          : undefined;

      const transaction = await rollbackToPrevious({
        config: builderConfig,
        ...(afterRestore ? { afterRestore } : {}),
      });

      process.stdout.write(
        `Rollback complete.\nTransaction: ${transaction.txId}\nLive: ${transaction.livePath}\nSnapshot: ${transaction.snapshotPath}\n`,
      );
    });
}

interface RollbackCommandOptions {
  readonly config?: string;
  readonly to: string;
  readonly singBoxBin?: string;
  readonly reload?: boolean;
}
