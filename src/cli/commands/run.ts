import type { Command } from "commander";

import { runConfig } from "../../modules/manager/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("Run sing-box in the foreground with a generated config.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("-i, --input <path>", "path to config JSON to run")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--no-check", "skip sing-box check before run")
    .action(async (options: RunCommandOptions) => {
      const builderConfig = await resolveBuilderConfig(options);
      const configPath =
        options.input ?? builderConfig?.output.livePath ?? builderConfig?.output.stagingPath;
      if (!configPath) {
        throw new Error("No config path resolved. Pass --input or provide a builder config.");
      }

      const exitCode = await runConfig({
        configPath,
        ...(options.singBoxBin ? { singBoxBinary: options.singBoxBin } : {}),
        validateFirst: options.check,
      });

      process.exitCode = exitCode;
    });
}

interface RunCommandOptions {
  readonly config?: string;
  readonly input?: string;
  readonly singBoxBin?: string;
  readonly check: boolean;
}
