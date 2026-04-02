import type { Command } from "commander";

import { checkConfig } from "../../modules/manager/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .description("Validate a generated sing-box config.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("-i, --input <path>", "path to config JSON to validate")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .action(async (options: CheckCommandOptions) => {
      const builderConfig = await resolveBuilderConfig(options);
      const configPath = options.input ?? builderConfig?.output.stagingPath;
      if (!configPath) {
        throw new Error("No config path resolved. Pass --input or provide a builder config.");
      }

      const result = await checkConfig({
        configPath,
        ...(options.singBoxBin
          ? { singBoxBinary: options.singBoxBin }
          : builderConfig?.runtime.dependencies.singBoxBinary
            ? { singBoxBinary: builderConfig.runtime.dependencies.singBoxBinary }
            : {}),
      });

      process.stdout.write(`OK: ${configPath}\nBinary: ${result.binaryPath}\n`);
    });
}

interface CheckCommandOptions {
  readonly config?: string;
  readonly input?: string;
  readonly singBoxBin?: string;
}
