import path from "node:path";

import type { Command } from "commander";

import {
  type StatusReport,
  type StatusSystemProxyService,
  collectStatusReport,
} from "../../modules/status/index.js";
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

      process.stdout.write(renderStatusOutput(report));
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

function formatProxyEndpoint(endpoint: { host: string; port: number }): string {
  return `${endpoint.host}:${endpoint.port}`;
}

function formatSystemProxyServices(services: readonly StatusSystemProxyService[]): string {
  if (services.length === 0) {
    return "unknown";
  }

  const enabledServices = services.filter((service) => service.enabled);
  if (enabledServices.length === 0) {
    return "inactive";
  }

  return enabledServices
    .map((service) => `${service.kind}=${formatSystemProxyService(service)}`)
    .join(", ");
}

function formatSystemProxyService(service: StatusSystemProxyService): string {
  if (service.host && typeof service.port === "number") {
    return `${service.host}:${service.port}`;
  }

  return "(incomplete)";
}

function renderStatusOutput(report: StatusReport): string {
  const lines = [
    "Runtime snapshot: current sing-box, proxy, schedule, and recent publish state.",
    "",
    ...renderSection("Context", [
      `generated: ${report.generatedAt}`,
      `config: ${report.builderConfigPath ?? "(missing)"}`,
    ]),
    "",
    ...renderSection("Summary", buildStatusSummaryLines(report)),
    "",
    ...renderSection("Runtime", buildRuntimeLines(report)),
    "",
    ...renderSection("Config & Schedule", buildConfigAndScheduleLines(report)),
    "",
    ...renderSection("Recent Publish", [formatLatestTransaction(report)]),
    "",
    ...renderSection(
      "Diagnostics",
      report.diagnostics.length > 0
        ? report.diagnostics.map((diagnostic) => `[${diagnostic.level}] ${diagnostic.message}`)
        : ["[info] No immediate problems detected."],
    ),
  ];

  return `${lines.join("\n")}\n`;
}

function buildStatusSummaryLines(report: StatusReport): string[] {
  const lines = [
    `runtime: ${formatProcessSummary(report)}`,
    `desktop-profile: ${report.runtime.desktopProfile ?? "none"}`,
  ];

  if (report.runtime.systemProxy) {
    lines.push(
      `proxy: state=${report.runtime.systemProxy.state}${
        report.runtime.systemProxy.drift !== undefined
          ? `, drift=${String(report.runtime.systemProxy.drift)}`
          : ""
      }`,
    );
  }

  if (report.runtime.watchdog) {
    lines.push(`watchdog: ${formatWatchdogSummary(report)}`);
  }

  lines.push(`latest-transaction: ${formatLatestTransaction(report)}`);
  return lines;
}

function buildRuntimeLines(report: StatusReport): string[] {
  const lines = [
    `binary: ${report.runtime.singBoxBinary ?? "(unresolved)"}${
      report.runtime.binarySource ? ` [${report.runtime.binarySource}]` : ""
    }`,
    `mode: ${report.runtime.mode ?? "(unknown)"}`,
    `desktop-runtime: ${report.runtime.desktopProfile ?? "none"} label=${report.runtime.runtimeLabel} installed=${String(report.runtime.launchAgentInstalled)}${
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
    `process: ${formatProcessSummary(report)}`,
    ...report.runtime.listeners.map(
      (listener) =>
        `listener ${listener.tag}: ${listener.listen}:${listener.port} ${listener.active ? "active" : "inactive"}`,
    ),
  ];

  if (report.runtime.systemProxy) {
    lines.push(
      `system-proxy: state=${report.runtime.systemProxy.state}${
        report.runtime.systemProxy.drift !== undefined
          ? ` drift=${String(report.runtime.systemProxy.drift)}`
          : ""
      } expected=${formatProxyEndpoint(report.runtime.systemProxy.expected)} actual=${formatSystemProxyServices(report.runtime.systemProxy.actual)}`,
    );
    if (report.runtime.systemProxy.nextAction) {
      lines.push(`proxy-hint: ${report.runtime.systemProxy.nextAction}`);
    }
  }

  if (report.runtime.watchdog) {
    lines.push(
      `watchdog: enabled=${String(report.runtime.watchdog.enabled)} label=${report.runtime.watchdog.label} installed=${String(report.runtime.watchdog.launchAgentInstalled)}${
        report.runtime.watchdog.launchAgentLoaded !== undefined
          ? ` loaded=${String(report.runtime.watchdog.launchAgentLoaded)}`
          : ""
      } interval=${report.runtime.watchdog.intervalSeconds}s${
        report.runtime.watchdog.lastResult
          ? ` last-result=${report.runtime.watchdog.lastResult}`
          : ""
      }${
        report.runtime.watchdog.lastRecoveryAction
          ? ` last-action=${report.runtime.watchdog.lastRecoveryAction}`
          : ""
      }${
        report.runtime.watchdog.lastTrigger
          ? ` last-trigger=${report.runtime.watchdog.lastTrigger}`
          : ""
      }${
        report.runtime.watchdog.lastCheckedAt
          ? ` last-recorded=${report.runtime.watchdog.lastCheckedAt}`
          : ""
      }${
        report.runtime.watchdog.lastReassertAt
          ? ` last-reassert=${report.runtime.watchdog.lastReassertAt}`
          : ""
      }${
        report.runtime.watchdog.lastRestartAt
          ? ` last-restart=${report.runtime.watchdog.lastRestartAt}`
          : ""
      }`,
    );
    if (report.runtime.watchdog.lastMessage) {
      lines.push(`watchdog-message: ${report.runtime.watchdog.lastMessage}`);
    }
    if (report.runtime.watchdog.lastError) {
      lines.push(`watchdog-error: ${report.runtime.watchdog.lastError}`);
    }
  }

  return lines;
}

function buildConfigAndScheduleLines(report: StatusReport): string[] {
  return [
    `live-config: ${report.config.livePath ?? "(unset)"}${report.config.liveExists ? " [present]" : " [missing]"}`,
    `schedule: ${report.scheduler.label} installed=${String(report.scheduler.installed)}${
      report.scheduler.loaded !== undefined ? ` loaded=${String(report.scheduler.loaded)}` : ""
    }`,
  ];
}

function formatProcessSummary(report: StatusReport): string {
  return report.runtime.processRunning
    ? `running${report.runtime.processIds.length > 0 ? ` (${report.runtime.processIds.join(", ")})` : ""}`
    : "stopped";
}

function formatWatchdogSummary(report: StatusReport): string {
  const watchdog = report.runtime.watchdog;
  if (!watchdog) {
    return "disabled";
  }

  return `${watchdog.enabled ? "enabled" : "disabled"}${watchdog.lastResult ? `, last-result=${watchdog.lastResult}` : ""}${
    watchdog.lastRecoveryAction ? `, last-action=${watchdog.lastRecoveryAction}` : ""
  }`;
}

function formatLatestTransaction(report: StatusReport): string {
  return report.history.lastTransactionId
    ? `${report.history.lastTransactionId} ${report.history.lastTransactionStatus ?? "unknown"} ${report.history.lastTransactionAt ?? ""}`.trim()
    : "(none)";
}

function renderSection(title: string, items: readonly string[]): string[] {
  return [`${title}:`, ...items.map((item) => `- ${item}`)];
}
