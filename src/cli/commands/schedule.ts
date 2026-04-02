import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Command } from "commander";

import { installLaunchdSchedule, removeLaunchdSchedule } from "../../modules/schedule/index.js";
import { findDefaultConfigPath, resolveBuilderConfig } from "../command-helpers.js";

export function registerScheduleCommand(program: Command): void {
  const schedule = program.command("schedule").description("Manage macOS launchd scheduling.");

  schedule
    .command("install")
    .description("Install a launchd job.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--label <label>", "LaunchAgent label", "org.singbox-iac.update")
    .option("--interval-minutes <minutes>", "override update interval in minutes")
    .option("--launch-agents-dir <path>", "override LaunchAgents directory")
    .option("--logs-dir <path>", "override log directory")
    .option("--cwd <path>", "working directory for launchd execution")
    .option("--sing-box-bin <path>", "path to sing-box binary for scheduled updates")
    .option("--chrome-bin <path>", "path to Chrome binary for scheduled verification")
    .option("-f, --force", "replace an existing LaunchAgent file")
    .option("--no-load", "write the plist without calling launchctl bootstrap")
    .action(async (options: InstallScheduleCommandOptions) => {
      const builderConfig = await resolveBuilderConfig(options);
      const configPath = options.config
        ? resolvePath(options.config)
        : await findDefaultConfigPath();
      if (!builderConfig || !configPath) {
        throw new Error("schedule install requires a builder config. Pass --config or run init.");
      }

      const intervalMinutes = options.intervalMinutes
        ? Number.parseInt(options.intervalMinutes, 10)
        : builderConfig.schedule.intervalMinutes;
      if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
        throw new Error("interval-minutes must be a positive integer.");
      }

      const result = await installLaunchdSchedule({
        configPath,
        intervalMinutes,
        cliEntrypoint: resolveCliEntrypoint(import.meta.url),
        label: options.label,
        ...(options.launchAgentsDir
          ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
          : {}),
        ...(options.logsDir ? { logsDir: resolvePath(options.logsDir) } : {}),
        ...(options.cwd ? { workingDirectory: resolvePath(options.cwd) } : {}),
        ...(options.singBoxBin
          ? { singBoxBinary: resolvePath(options.singBoxBin) }
          : builderConfig.runtime.dependencies.singBoxBinary
            ? { singBoxBinary: builderConfig.runtime.dependencies.singBoxBinary }
            : {}),
        ...(options.chromeBin
          ? { chromeBinary: resolvePath(options.chromeBin) }
          : builderConfig.runtime.dependencies.chromeBinary
            ? { chromeBinary: builderConfig.runtime.dependencies.chromeBinary }
            : {}),
        force: options.force === true,
        load: options.load !== false,
      });

      process.stdout.write(
        `${[
          `Label: ${result.label}`,
          `Plist: ${result.plistPath}`,
          `Stdout: ${result.stdoutPath}`,
          `Stderr: ${result.stderrPath}`,
        ].join("\n")}\n`,
      );
    });

  schedule
    .command("remove")
    .description("Remove a launchd job.")
    .option("--label <label>", "LaunchAgent label", "org.singbox-iac.update")
    .option("--launch-agents-dir <path>", "override LaunchAgents directory")
    .option("--no-unload", "remove the plist without calling launchctl bootout")
    .action(async (options: RemoveScheduleCommandOptions) => {
      const plistPath = await removeLaunchdSchedule({
        label: options.label,
        ...(options.launchAgentsDir
          ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
          : {}),
        unload: options.unload !== false,
      });

      process.stdout.write(`Removed: ${plistPath}\n`);
    });
}

interface SharedScheduleOptions {
  readonly config?: string;
}

interface InstallScheduleCommandOptions extends SharedScheduleOptions {
  readonly label: string;
  readonly intervalMinutes?: string;
  readonly launchAgentsDir?: string;
  readonly logsDir?: string;
  readonly cwd?: string;
  readonly singBoxBin?: string;
  readonly chromeBin?: string;
  readonly force?: boolean;
  readonly load?: boolean;
}

interface RemoveScheduleCommandOptions {
  readonly label: string;
  readonly launchAgentsDir?: string;
  readonly unload?: boolean;
}

function resolvePath(filePath: string): string {
  return filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
}

function resolveCliEntrypoint(moduleUrl: string): string {
  const commandModulePath = fileURLToPath(moduleUrl);
  const extension = path.extname(commandModulePath);
  return path.resolve(path.dirname(commandModulePath), "..", `index${extension}`);
}
