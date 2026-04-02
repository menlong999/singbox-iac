import path from "node:path";

import type { Command } from "commander";

import { collectStatusReport } from "../../modules/status/index.js";
import { findDefaultConfigPath, resolveBuilderConfig } from "../command-helpers.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show the current sing-box runtime, config, schedule, and transaction status.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--launch-agents-dir <path>", "override LaunchAgents directory")
    .option("--label <label>", "LaunchAgent label", "org.singbox-iac.update")
    .option("--runtime-label <label>", "runtime LaunchAgent label")
    .option("--json", "print machine-readable JSON")
    .action(async (options: StatusCommandOptions) => {
      const [config, configPath] = await Promise.all([
        resolveBuilderConfig(options),
        options.config ? Promise.resolve(resolvePath(options.config)) : findDefaultConfigPath(),
      ]);

      const report = await collectStatusReport({
        ...(config ? { config } : {}),
        ...(configPath ? { configPath } : {}),
        ...(options.singBoxBin ? { singBoxBinary: resolvePath(options.singBoxBin) } : {}),
        ...(options.launchAgentsDir
          ? { launchAgentsDir: resolvePath(options.launchAgentsDir) }
          : {}),
        label: options.label,
        ...(options.runtimeLabel ? { runtimeLabel: options.runtimeLabel } : {}),
      });

      if (options.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return;
      }

      const lines = [
        `Generated: ${report.generatedAt}`,
        `Config: ${report.builderConfigPath ?? "(missing)"}`,
        `Binary: ${report.runtime.singBoxBinary ?? "(unresolved)"}${
          report.runtime.binarySource ? ` [${report.runtime.binarySource}]` : ""
        }`,
        `Mode: ${report.runtime.mode ?? "(unknown)"}`,
        `Desktop runtime: ${report.runtime.desktopProfile ?? "none"} label=${report.runtime.runtimeLabel} installed=${String(report.runtime.launchAgentInstalled)}${
          report.runtime.launchAgentLoaded !== undefined
            ? ` loaded=${String(report.runtime.launchAgentLoaded)}`
            : ""
        }${
          report.runtime.systemProxyActive !== undefined
            ? ` system-proxy=${String(report.runtime.systemProxyActive)}`
            : ""
        }${
          report.runtime.tunInterfacePresent !== undefined
            ? ` tun=${String(report.runtime.tunInterfacePresent)}`
            : ""
        }`,
        `Process: ${report.runtime.processRunning ? "running" : "stopped"}${
          report.runtime.processIds.length > 0 ? ` (${report.runtime.processIds.join(", ")})` : ""
        }`,
        `Live config: ${report.config.livePath ?? "(unset)"}${
          report.config.liveExists ? " [present]" : " [missing]"
        }`,
        `Schedule: ${report.scheduler.label} installed=${String(report.scheduler.installed)}${
          report.scheduler.loaded !== undefined ? ` loaded=${String(report.scheduler.loaded)}` : ""
        }`,
        "Listeners:",
        ...report.runtime.listeners.map(
          (listener) =>
            `- ${listener.tag}: ${listener.listen}:${listener.port} ${listener.active ? "active" : "inactive"}`,
        ),
        "Transactions:",
        report.history.lastTransactionId
          ? `- ${report.history.lastTransactionId} ${report.history.lastTransactionStatus ?? "unknown"} ${report.history.lastTransactionAt ?? ""}`.trim()
          : "- (none)",
        "Diagnostics:",
        ...(report.diagnostics.length > 0
          ? report.diagnostics.map((diagnostic) => `- [${diagnostic.level}] ${diagnostic.message}`)
          : ["- [info] No immediate problems detected."]),
      ];
      process.stdout.write(`${lines.join("\n")}\n`);
    });
}

interface StatusCommandOptions {
  readonly config?: string;
  readonly singBoxBin?: string;
  readonly launchAgentsDir?: string;
  readonly label: string;
  readonly runtimeLabel?: string;
  readonly json?: boolean;
}

function resolvePath(filePath: string): string {
  return filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
}
