import type { Command } from "commander";

import { getDefaultConfigPath, getDefaultRulesPath } from "../command-helpers.js";
import { runSetupFlow } from "./setup.js";

export function registerGoCommand(program: Command): void {
  const command = program
    .command("go")
    .description("Shortest first-run onboarding: subscription URL plus one routing sentence.")
    .argument("<subscription-url>", "subscription URL")
    .argument("<prompt>", "one-sentence routing intent")
    .option("-c, --config <path>", "path to builder config YAML", getDefaultConfigPath())
    .option("--rules-out <path>", "path to generated custom-rules file", getDefaultRulesPath())
    .option("-f, --force", "overwrite generated files during first-time setup")
    .option("--no-run", "prepare and publish, but do not keep sing-box in the foreground")
    .option("--no-browser", "skip opening isolated browser windows during the foreground run")
    .option("--no-load", "write the LaunchAgent without calling launchctl bootstrap")
    .action(
      async (
        subscriptionUrl: string,
        prompt: string,
        options: {
          readonly config: string;
          readonly rulesOut: string;
          readonly force?: boolean;
          readonly run?: boolean;
          readonly browser?: boolean;
          readonly load?: boolean;
        },
      ) => {
        await runSetupFlow({
          config: options.config,
          rulesOut: options.rulesOut,
          subscriptionUrl,
          prompt,
          execArg: [],
          label: "org.singbox-iac.update",
          ...(options.force ? { force: true } : {}),
          doctor: true,
          verify: true,
          apply: true,
          ready: true,
          installSchedule: true,
          run: options.run !== false,
          openBrowser: options.browser !== false,
          load: options.load !== false,
        });
      },
    );

  for (const optionName of ["rulesOut", "browser", "load"]) {
    command.options.find((entry) => entry.attributeName() === optionName)?.hideHelp();
  }
}
