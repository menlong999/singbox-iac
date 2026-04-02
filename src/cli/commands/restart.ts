import path from "node:path";

import type { Command } from "commander";

import {
  installDesktopRuntimeAgent,
  removeDesktopRuntimeAgent,
} from "../../modules/desktop-runtime/index.js";
import { checkConfig, resolveSingBoxBinary } from "../../modules/manager/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerRestartCommand(program: Command): void {
  program
    .command("restart")
    .description("Restart the dedicated desktop sing-box runtime LaunchAgent.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--label <label>", "runtime LaunchAgent label")
    .option("--launch-agents-dir <path>", "override LaunchAgents directory")
    .option("--logs-dir <path>", "override launchd log directory")
    .option("--no-load", "write the runtime LaunchAgent without calling launchctl bootstrap")
    .action(async (options: RestartCommandOptions) => {
      const builderConfig = await resolveBuilderConfig(options);
      if (!builderConfig) {
        throw new Error("Restart requires a builder config. Run `singbox-iac go` first.");
      }
      if (builderConfig.runtime.desktop.profile === "none") {
        throw new Error(
          "Desktop runtime profile is disabled in this config. Re-run onboarding or set runtime.desktop.profile first.",
        );
      }

      const label = options.label ?? builderConfig.runtime.desktop.launchAgentLabel;
      const singBoxBinary = await resolveSingBoxBinary(
        options.singBoxBin ? resolvePath(options.singBoxBin) : undefined,
        builderConfig.runtime.dependencies.singBoxBinary,
      );
      await checkConfig({
        configPath: builderConfig.output.livePath,
        singBoxBinary,
      });
      await removeDesktopRuntimeAgent({
        label,
        ...(options.launchAgentsDir
          ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
          : {}),
      });

      const result = await installDesktopRuntimeAgent({
        liveConfigPath: builderConfig.output.livePath,
        singBoxBinary,
        label,
        ...(options.launchAgentsDir
          ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
          : {}),
        ...(options.logsDir ? { logsDir: resolvePath(options.logsDir) } : {}),
        force: true,
        load: options.load !== false,
      });

      process.stdout.write(
        `${[
          `Restarted desktop runtime profile: ${builderConfig.runtime.desktop.profile}`,
          `Label: ${result.label}`,
          `Live config: ${builderConfig.output.livePath}`,
          `LaunchAgent: ${result.plistPath}`,
        ].join("\n")}\n`,
      );
    });
}

interface RestartCommandOptions {
  readonly config?: string;
  readonly singBoxBin?: string;
  readonly label?: string;
  readonly launchAgentsDir?: string;
  readonly logsDir?: string;
  readonly load?: boolean;
}

function resolvePath(filePath: string): string {
  return filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
}
