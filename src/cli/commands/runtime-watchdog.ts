import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/load-config.js";
import { runRuntimeWatchdogTick } from "../../modules/runtime-watchdog/index.js";
import { findDefaultConfigPath } from "../command-helpers.js";

export function registerRuntimeWatchdogCommand(program: Command): void {
  program
    .command("runtime-watchdog")
    .description("Internal command used by the desktop runtime watchdog LaunchAgent.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--json", "print machine-readable JSON")
    .action(async (options: RuntimeWatchdogCommandOptions) => {
      const configPath = options.config
        ? resolvePath(options.config)
        : await findDefaultConfigPath();
      if (!configPath) {
        throw new Error("runtime-watchdog requires a builder config path.");
      }

      const config = await loadConfig(configPath);
      const result = await runRuntimeWatchdogTick({
        config,
        configPath,
      });

      if (options.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      process.stdout.write(
        `${[
          `Watchdog label: ${config.runtime.desktop.watchdog.launchAgentLabel}`,
          `Result: ${result.state.lastResult}`,
          ...(result.state.lastRecoveryAction
            ? [`Recovery action: ${result.state.lastRecoveryAction}`]
            : []),
          ...(result.state.lastTrigger ? [`Trigger: ${result.state.lastTrigger}`] : []),
          `Recorded: ${result.state.lastCheckedAt}`,
          `Message: ${result.state.lastMessage}`,
          ...(result.state.lastReassertAt ? [`Last reassert: ${result.state.lastReassertAt}`] : []),
          ...(result.state.lastRestartAt ? [`Last restart: ${result.state.lastRestartAt}`] : []),
          ...(result.state.lastError ? [`Error: ${result.state.lastError}`] : []),
        ].join("\n")}\n`,
      );
    });
}

interface RuntimeWatchdogCommandOptions {
  readonly config?: string;
  readonly json?: boolean;
}

function resolvePath(filePath: string): string {
  return filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
}
