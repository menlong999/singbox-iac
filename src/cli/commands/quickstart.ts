import type { Command } from "commander";

import { getDefaultConfigPath, getDefaultRulesPath } from "../command-helpers.js";
import { runSetupFlow } from "./setup.js";

export function registerQuickstartCommand(program: Command): void {
  program
    .command("quickstart")
    .description(
      "Fast first-run flow: provide a subscription URL and one routing sentence, then prepare, verify, publish, schedule, and optionally run.",
    )
    .requiredOption("--subscription-url <url>", "subscription URL")
    .requiredOption("-p, --prompt <text>", "one-sentence routing intent")
    .option("-c, --config <path>", "path to builder config YAML", getDefaultConfigPath())
    .option("--rules-out <path>", "path to generated custom-rules file", getDefaultRulesPath())
    .option("--provider <provider>", "authoring provider: deterministic, auto, claude, exec")
    .option("--author-timeout-ms <ms>", "timeout for local AI CLI authoring")
    .option("--exec-command <command>", "command for the exec authoring provider")
    .option(
      "--exec-arg <arg>",
      "append one argument for the exec authoring provider",
      collectOption,
      [],
    )
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--chrome-bin <path>", "path to Chrome binary")
    .option("--label <label>", "LaunchAgent label", "org.singbox-iac.update")
    .option("--launch-agents-dir <path>", "override LaunchAgents directory")
    .option("--logs-dir <path>", "override launchd log directory")
    .option("-f, --force", "overwrite generated files during first-time setup")
    .option("--no-run", "prepare and publish, but do not keep sing-box in the foreground")
    .option("--no-browser", "skip opening isolated browser windows during the foreground run")
    .option("--no-load", "write the LaunchAgent without calling launchctl bootstrap")
    .action(async (options: QuickstartCommandOptions) => {
      await runSetupFlow({
        config: options.config,
        rulesOut: options.rulesOut,
        subscriptionUrl: options.subscriptionUrl,
        prompt: options.prompt,
        ...(options.provider ? { provider: options.provider } : {}),
        ...(options.authorTimeoutMs ? { authorTimeoutMs: options.authorTimeoutMs } : {}),
        ...(options.execCommand ? { execCommand: options.execCommand } : {}),
        ...(options.execArg.length > 0 ? { execArg: options.execArg } : { execArg: [] }),
        ...(options.singBoxBin ? { singBoxBin: options.singBoxBin } : {}),
        ...(options.chromeBin ? { chromeBin: options.chromeBin } : {}),
        label: options.label,
        ...(options.launchAgentsDir ? { launchAgentsDir: options.launchAgentsDir } : {}),
        ...(options.logsDir ? { logsDir: options.logsDir } : {}),
        ...(options.force ? { force: options.force } : {}),
        ...(options.load !== undefined ? { load: options.load } : {}),
        doctor: true,
        verify: true,
        apply: true,
        ready: true,
        installSchedule: true,
        run: options.run !== false,
        openBrowser: options.browser !== false,
      });
    });
}

interface QuickstartCommandOptions {
  readonly config: string;
  readonly rulesOut: string;
  readonly subscriptionUrl: string;
  readonly prompt: string;
  readonly provider?: "deterministic" | "auto" | "claude" | "exec";
  readonly authorTimeoutMs?: string;
  readonly execCommand?: string;
  readonly execArg: string[];
  readonly singBoxBin?: string;
  readonly chromeBin?: string;
  readonly label: string;
  readonly launchAgentsDir?: string;
  readonly logsDir?: string;
  readonly force?: boolean;
  readonly run?: boolean;
  readonly browser?: boolean;
  readonly load?: boolean;
}

function collectOption(value: string, previous: readonly string[]): string[] {
  return [...previous, value];
}
