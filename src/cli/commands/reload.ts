import type { Command } from "commander";

import { reloadRuntime } from "../../modules/manager/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerReloadCommand(program: Command): void {
  program
    .command("reload")
    .description("Reload the running sing-box process.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .action(async (options: ReloadCommandOptions) => {
      const builderConfig = await resolveBuilderConfig(options);
      if (!builderConfig) {
        throw new Error("A builder config is required for reload.");
      }

      await reloadRuntime({
        ...(options.singBoxBin ? { singBoxBinary: options.singBoxBin } : {}),
        runtime: builderConfig.runtime.reload,
      });

      process.stdout.write("Reloaded sing-box runtime.\n");
    });
}

interface ReloadCommandOptions {
  readonly config?: string;
  readonly singBoxBin?: string;
}
