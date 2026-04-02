import path from "node:path";

import type { Command } from "commander";

import {
  defaultRuntimeLaunchAgentLabel,
  removeDesktopRuntimeAgent,
} from "../../modules/desktop-runtime/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerStopCommand(program: Command): void {
  program
    .command("stop")
    .description("Stop the dedicated desktop sing-box runtime LaunchAgent.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--label <label>", "runtime LaunchAgent label")
    .option("--launch-agents-dir <path>", "override LaunchAgents directory")
    .option("--no-unload", "remove the LaunchAgent file without calling launchctl bootout")
    .action(async (options: StopCommandOptions) => {
      const builderConfig = await resolveBuilderConfig(options);
      const plistPath = await removeDesktopRuntimeAgent({
        label:
          options.label ??
          builderConfig?.runtime.desktop.launchAgentLabel ??
          defaultRuntimeLaunchAgentLabel,
        ...(options.launchAgentsDir
          ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
          : {}),
        unload: options.unload !== false,
      });

      process.stdout.write(`Stopped desktop runtime LaunchAgent: ${plistPath}\n`);
    });
}

interface StopCommandOptions {
  readonly config?: string;
  readonly label?: string;
  readonly launchAgentsDir?: string;
  readonly unload?: boolean;
}

function resolvePath(filePath: string): string {
  return filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
}
