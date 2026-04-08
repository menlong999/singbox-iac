import path from "node:path";

import type { Command } from "commander";

import {
  installDesktopRuntimeAgent,
  removeDesktopRuntimeAgent,
  restartDesktopRuntimeAgent,
} from "../../modules/desktop-runtime/index.js";
import { checkConfig, resolveSingBoxBinary } from "../../modules/manager/index.js";
import {
  installRuntimeWatchdogAgent,
  removeRuntimeWatchdogAgent,
} from "../../modules/runtime-watchdog/index.js";
import {
  findDefaultConfigPath,
  resolveBuilderConfig,
  resolveCliEntrypoint,
} from "../command-helpers.js";

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
      const configPath = options.config
        ? resolvePath(options.config)
        : await findDefaultConfigPath();
      if (!builderConfig) {
        throw new Error("Restart requires a builder config. Run `singbox-iac go` first.");
      }
      if (!configPath) {
        throw new Error("Restart requires a builder config path.");
      }
      if (builderConfig.runtime.desktop.profile === "none") {
        throw new Error(
          "Desktop runtime profile is disabled in this config. Re-run onboarding or set runtime.desktop.profile first.",
        );
      }

      const label = options.label ?? builderConfig.runtime.desktop.launchAgentLabel;
      const watchdogLabel = builderConfig.runtime.desktop.watchdog.launchAgentLabel;
      const singBoxBinary = await resolveSingBoxBinary(
        options.singBoxBin ? resolvePath(options.singBoxBin) : undefined,
        builderConfig.runtime.dependencies.singBoxBinary,
      );
      await checkConfig({
        configPath: builderConfig.output.livePath,
        singBoxBinary,
      });

      const hasOverrides =
        options.singBoxBin !== undefined ||
        options.launchAgentsDir !== undefined ||
        options.logsDir !== undefined;
      const needsWatchdogLifecycle =
        builderConfig.runtime.desktop.profile === "system-proxy" &&
        builderConfig.runtime.desktop.watchdog.enabled;

      if (options.load !== false && !hasOverrides && !needsWatchdogLifecycle) {
        try {
          await restartDesktopRuntimeAgent({ label });
          process.stdout.write(
            `${[
              `Restarted desktop runtime profile: ${builderConfig.runtime.desktop.profile}`,
              `Label: ${label}`,
              `Live config: ${builderConfig.output.livePath}`,
              "Method: launchctl kickstart -k",
            ].join("\n")}\n`,
          );
          return;
        } catch {
          // Fall through to a full remove/install when the service is not loaded.
        }
      }

      await removeDesktopRuntimeAgent({
        label,
        ...(options.launchAgentsDir
          ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
          : {}),
      });
      if (
        builderConfig.runtime.desktop.profile === "system-proxy" &&
        builderConfig.runtime.desktop.watchdog.enabled
      ) {
        await removeRuntimeWatchdogAgent({
          label: watchdogLabel,
          ...(options.launchAgentsDir
            ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
            : {}),
        });
      }

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
      const watchdogResult =
        builderConfig.runtime.desktop.profile === "system-proxy" &&
        builderConfig.runtime.desktop.watchdog.enabled
          ? await installRuntimeWatchdogAgent({
              configPath,
              cliEntrypoint: resolveCliEntrypoint(import.meta.url),
              intervalSeconds: builderConfig.runtime.desktop.watchdog.intervalSeconds,
              label: watchdogLabel,
              ...(options.launchAgentsDir
                ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
                : {}),
              ...(options.logsDir ? { logsDir: resolvePath(options.logsDir) } : {}),
              force: true,
              load: options.load !== false,
            })
          : undefined;

      process.stdout.write(
        `${[
          `Restarted desktop runtime profile: ${builderConfig.runtime.desktop.profile}`,
          `Label: ${result.label}`,
          `Live config: ${builderConfig.output.livePath}`,
          `LaunchAgent: ${result.plistPath}`,
          ...(watchdogResult
            ? [
                `Watchdog: ${watchdogResult.label}`,
                `Watchdog LaunchAgent: ${watchdogResult.plistPath}`,
              ]
            : []),
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
