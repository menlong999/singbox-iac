import path from "node:path";

import type { Command } from "commander";

import { installDesktopRuntimeAgent } from "../../modules/desktop-runtime/index.js";
import { checkConfig, resolveSingBoxBinary } from "../../modules/manager/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Start the desktop sing-box runtime as a launchd agent.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--label <label>", "runtime LaunchAgent label")
    .option("--launch-agents-dir <path>", "override LaunchAgents directory")
    .option("--logs-dir <path>", "override launchd log directory")
    .option("-f, --force", "replace an existing runtime LaunchAgent")
    .option("--no-load", "write the runtime LaunchAgent without calling launchctl bootstrap")
    .action(async (options: StartCommandOptions) => {
      const builderConfig = await resolveBuilderConfig(options);
      if (!builderConfig) {
        throw new Error("Start requires a builder config. Run `singbox-iac go` first.");
      }
      if (builderConfig.runtime.desktop.profile === "none") {
        throw new Error(
          "Desktop runtime profile is disabled in this config. Re-run onboarding or set runtime.desktop.profile first.",
        );
      }

      const singBoxBinary = await resolveSingBoxBinary(
        options.singBoxBin ? resolvePath(options.singBoxBin) : undefined,
        builderConfig.runtime.dependencies.singBoxBinary,
      );
      await checkConfig({
        configPath: builderConfig.output.livePath,
        singBoxBinary,
      });

      const result = await installDesktopRuntimeAgent({
        liveConfigPath: builderConfig.output.livePath,
        singBoxBinary,
        label: options.label ?? builderConfig.runtime.desktop.launchAgentLabel,
        ...(options.launchAgentsDir
          ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
          : {}),
        ...(options.logsDir ? { logsDir: resolvePath(options.logsDir) } : {}),
        force: options.force === true,
        load: options.load !== false,
      });

      process.stdout.write(
        `${[
          `Started desktop runtime profile: ${builderConfig.runtime.desktop.profile}`,
          `Label: ${result.label}`,
          `Live config: ${builderConfig.output.livePath}`,
          `LaunchAgent: ${result.plistPath}`,
        ].join("\n")}\n`,
      );
    });
}

interface StartCommandOptions {
  readonly config?: string;
  readonly singBoxBin?: string;
  readonly label?: string;
  readonly launchAgentsDir?: string;
  readonly logsDir?: string;
  readonly force?: boolean;
  readonly load?: boolean;
}

function resolvePath(filePath: string): string {
  return filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
}
