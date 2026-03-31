import path from "node:path";

import type { Command } from "commander";

import { initWorkspace } from "../../modules/init/index.js";
import {
  getDefaultConfigPath,
  getDefaultRulesPath,
  resolvePackageRoot,
} from "../command-helpers.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create example singbox-iac configuration assets.")
    .option("-c, --config-out <path>", "path to write builder config", getDefaultConfigPath())
    .option("--rules-out <path>", "path to write the custom rules YAML", getDefaultRulesPath())
    .option("--subscription-url <url>", "seed the generated config with a real subscription URL")
    .option("-f, --force", "overwrite existing generated assets")
    .action(async (options: InitCommandOptions) => {
      const result = await initWorkspace({
        configOutPath: path.resolve(options.configOut),
        rulesOutPath: path.resolve(options.rulesOut),
        examplesDir: path.join(resolvePackageRoot(import.meta.url), "examples"),
        ...(options.subscriptionUrl ? { subscriptionUrl: options.subscriptionUrl } : {}),
        force: options.force === true,
      });

      process.stdout.write(
        `${[`Config: ${result.configPath}`, `Rules: ${result.rulesPath}`].join("\n")}\n`,
      );
    });
}

interface InitCommandOptions {
  readonly configOut: string;
  readonly rulesOut: string;
  readonly subscriptionUrl?: string;
  readonly force?: boolean;
}
