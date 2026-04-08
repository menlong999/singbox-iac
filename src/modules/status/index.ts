import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";

import type { BuilderConfig } from "../../config/schema.js";
import { resolveEffectiveIntent } from "../build/index.js";
import { defaultRuntimeLaunchAgentLabel } from "../desktop-runtime/index.js";
import { resolveSingBoxDependency } from "../runtime-dependencies/index.js";
import { inferRuntimeMode } from "../runtime-mode/index.js";
import {
  defaultRuntimeWatchdogLaunchAgentLabel,
  readRuntimeWatchdogState,
  resolveRuntimeWatchdogStatePath,
} from "../runtime-watchdog/index.js";
import { defaultLaunchAgentLabel } from "../schedule/index.js";
import { listTransactionHistory } from "../transactions/index.js";

export interface StatusInput {
  readonly config?: BuilderConfig;
  readonly configPath?: string;
  readonly singBoxBinary?: string;
  readonly launchAgentsDir?: string;
  readonly label?: string;
  readonly runtimeLabel?: string;
}

export interface StatusReport {
  readonly generatedAt: string;
  readonly builderConfigPath?: string;
  readonly runtime: {
    readonly singBoxBinary?: string;
    readonly binarySource?: string;
    readonly processRunning: boolean;
    readonly processIds: readonly number[];
    readonly mode?: string;
    readonly desktopProfile?: string;
    readonly runtimeLabel: string;
    readonly launchAgentInstalled: boolean;
    readonly launchAgentLoaded?: boolean;
    readonly systemProxyActive?: boolean;
    readonly systemProxy?: StatusSystemProxyState;
    readonly watchdog?: StatusRuntimeWatchdog;
    readonly tunInterfacePresent?: boolean;
    readonly listeners: readonly StatusListener[];
  };
  readonly config: {
    readonly stagingPath?: string;
    readonly livePath?: string;
    readonly backupPath?: string;
    readonly liveExists: boolean;
  };
  readonly scheduler: {
    readonly enabled: boolean;
    readonly label: string;
    readonly installed: boolean;
    readonly loaded?: boolean;
    readonly plistPath: string;
  };
  readonly history: {
    readonly lastTransactionId?: string;
    readonly lastTransactionStatus?: string;
    readonly lastTransactionAt?: string;
  };
  readonly diagnostics: readonly StatusDiagnostic[];
}

export interface StatusListener {
  readonly tag: string;
  readonly listen: string;
  readonly port: number;
  readonly active: boolean;
}

export interface StatusDiagnostic {
  readonly level: "info" | "warn" | "error";
  readonly message: string;
}

export interface StatusProxyEndpoint {
  readonly host: string;
  readonly port: number;
}

export interface StatusSystemProxyService {
  readonly kind: "http" | "https" | "socks";
  readonly enabled: boolean;
  readonly host?: string;
  readonly port?: number;
}

export interface StatusSystemProxyState {
  readonly expected: StatusProxyEndpoint;
  readonly actual: readonly StatusSystemProxyService[];
  readonly state: "active" | "inactive" | "endpoint-mismatch" | "listener-missing" | "unknown";
  readonly drift?: boolean;
  readonly nextAction?: string;
}

export interface SystemProxyRuntimeSnapshot {
  readonly processRunning: boolean;
  readonly processIds: readonly number[];
  readonly listenerActive: boolean;
  readonly systemProxy: StatusSystemProxyState;
}

export interface StatusRuntimeWatchdog {
  readonly enabled: boolean;
  readonly intervalSeconds: number;
  readonly label: string;
  readonly launchAgentInstalled: boolean;
  readonly launchAgentLoaded?: boolean;
  readonly statePath: string;
  readonly lastCheckedAt?: string;
  readonly lastResult?: string;
  readonly lastMessage?: string;
  readonly lastTrigger?: string;
  readonly lastRecoveryAction?: string;
  readonly lastReassertAt?: string;
  readonly lastRestartAt?: string;
  readonly lastError?: string;
}

export async function collectStatusReport(input: StatusInput): Promise<StatusReport> {
  const diagnostics: StatusDiagnostic[] = [];
  const schedulerLabel = input.label ?? defaultLaunchAgentLabel;
  const runtimeLabel =
    input.runtimeLabel ??
    input.config?.runtime.desktop.launchAgentLabel ??
    defaultRuntimeLaunchAgentLabel;
  const launchAgentsDir = input.launchAgentsDir ?? path.join(homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(launchAgentsDir, `${schedulerLabel}.plist`);
  const runtimePlistPath = path.join(launchAgentsDir, `${runtimeLabel}.plist`);
  const watchdogConfig = input.config?.runtime.desktop.watchdog;
  const watchdogLabel = watchdogConfig?.launchAgentLabel ?? defaultRuntimeWatchdogLaunchAgentLabel;
  const watchdogPlistPath = path.join(launchAgentsDir, `${watchdogLabel}.plist`);

  let runtimeBinaryPath: string | undefined;
  let runtimeBinarySource: string | undefined;

  try {
    const resolved = await resolveSingBoxDependency({
      ...(input.singBoxBinary ? { explicitPath: input.singBoxBinary } : {}),
      ...(input.config?.runtime.dependencies.singBoxBinary
        ? { persistedPath: input.config.runtime.dependencies.singBoxBinary }
        : {}),
    });
    runtimeBinaryPath = resolved.path;
    runtimeBinarySource = resolved.source;
  } catch (error) {
    diagnostics.push({
      level: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const processName = input.config?.runtime.reload.processName ?? "sing-box";
  const processIds = await listProcessIds(processName);
  const processRunning = processIds.length > 0;
  if (!processRunning) {
    diagnostics.push({
      level: "warn",
      message: `No running ${processName} process was found.`,
    });
  }

  const listeners = input.config
    ? await Promise.all(
        [
          {
            tag: "in-mixed",
            listen: input.config.listeners.mixed.listen,
            port: input.config.listeners.mixed.port,
          },
          {
            tag: "in-proxifier",
            listen: input.config.listeners.proxifier.listen,
            port: input.config.listeners.proxifier.port,
          },
        ].map(async (listener) => ({
          ...listener,
          active: await isTcpListenerActive(listener.listen, listener.port),
        })),
      )
    : [];

  const livePath = input.config?.output.livePath;
  const liveExists = livePath ? await pathExists(livePath) : false;
  if (livePath && !liveExists) {
    diagnostics.push({
      level: "warn",
      message: `Live config is missing: ${livePath}`,
    });
  }

  const installed = await pathExists(plistPath);
  const loaded = installed ? await isLaunchAgentLoaded(schedulerLabel) : undefined;
  const runtimeInstalled = await pathExists(runtimePlistPath);
  const runtimeLoaded = runtimeInstalled ? await isLaunchAgentLoaded(runtimeLabel) : undefined;
  const watchdogInstalled = await pathExists(watchdogPlistPath);
  const watchdogLoaded = watchdogInstalled ? await isLaunchAgentLoaded(watchdogLabel) : undefined;
  if (input.config?.schedule.enabled && !installed) {
    diagnostics.push({
      level: "warn",
      message: `Schedule is enabled in builder config but no LaunchAgent exists at ${plistPath}.`,
    });
  } else if (installed && loaded === false) {
    diagnostics.push({
      level: "warn",
      message: `LaunchAgent exists but is not loaded: ${schedulerLabel}`,
    });
  }

  const history = input.config ? await listTransactionHistory(input.config) : [];
  const latestTransaction = history[0];

  let mode: string | undefined;
  const desktopProfile = input.config?.runtime.desktop.profile;
  const systemProxyServices =
    desktopProfile === "system-proxy" && input.config ? await readSystemProxyServices() : undefined;
  const systemProxy =
    desktopProfile === "system-proxy" && input.config
      ? assessSystemProxyState({
          processRunning,
          listenerActive:
            listeners.find((listener) => listener.tag === "in-mixed")?.active ?? false,
          expected: {
            host: input.config.listeners.mixed.listen,
            port: input.config.listeners.mixed.port,
          },
          ...(systemProxyServices ? { actual: systemProxyServices } : {}),
        })
      : undefined;
  const systemProxyActive =
    systemProxy?.state === "active"
      ? true
      : systemProxy && systemProxy.state !== "unknown"
        ? false
        : undefined;
  const tunInterfacePresent =
    desktopProfile === "tun" && input.config
      ? await isTunInterfacePresent(input.config.runtime.desktop.tun.interfaceName)
      : undefined;
  if (input.config) {
    mode = inferRuntimeMode({
      phase: processRunning ? "onboarding" : "update",
      config: input.config,
      intent: await resolveEffectiveIntent(input.config),
    });
  }

  const watchdogState = watchdogConfig
    ? await readRuntimeWatchdogState(resolveRuntimeWatchdogStatePath(watchdogLabel))
    : undefined;
  const watchdog =
    watchdogConfig && desktopProfile === "system-proxy"
      ? {
          enabled: watchdogConfig.enabled,
          intervalSeconds: watchdogConfig.intervalSeconds,
          label: watchdogLabel,
          launchAgentInstalled: watchdogInstalled,
          ...(watchdogLoaded !== undefined ? { launchAgentLoaded: watchdogLoaded } : {}),
          statePath: resolveRuntimeWatchdogStatePath(watchdogLabel),
          ...(watchdogState?.lastCheckedAt ? { lastCheckedAt: watchdogState.lastCheckedAt } : {}),
          ...(watchdogState?.lastResult ? { lastResult: watchdogState.lastResult } : {}),
          ...(watchdogState?.lastMessage ? { lastMessage: watchdogState.lastMessage } : {}),
          ...(watchdogState?.lastTrigger ? { lastTrigger: watchdogState.lastTrigger } : {}),
          ...(watchdogState?.lastRecoveryAction
            ? { lastRecoveryAction: watchdogState.lastRecoveryAction }
            : {}),
          ...(watchdogState?.lastReassertAt
            ? { lastReassertAt: watchdogState.lastReassertAt }
            : {}),
          ...(watchdogState?.lastRestartAt ? { lastRestartAt: watchdogState.lastRestartAt } : {}),
          ...(watchdogState?.lastError ? { lastError: watchdogState.lastError } : {}),
        }
      : undefined;

  if (processRunning) {
    for (const listener of listeners.filter((entry) => !entry.active)) {
      if (desktopProfile === "system-proxy" && listener.tag === "in-mixed") {
        continue;
      }
      diagnostics.push({
        level: "warn",
        message: `${listener.tag} is configured on ${listener.listen}:${listener.port} but is not accepting connections.`,
      });
    }
  }

  if (desktopProfile === "system-proxy" && processRunning && systemProxy) {
    const systemProxyDiagnostic = createSystemProxyDiagnostic(systemProxy);
    if (systemProxyDiagnostic) {
      diagnostics.push(systemProxyDiagnostic);
    }
  }

  if (desktopProfile === "tun" && processRunning && tunInterfacePresent === false) {
    diagnostics.push({
      level: "warn",
      message:
        "Desktop runtime is running in TUN mode, but no matching TUN interface was detected.",
    });
  }

  if (runtimeInstalled && runtimeLoaded === false) {
    diagnostics.push({
      level: "warn",
      message: `Runtime LaunchAgent exists but is not loaded: ${runtimeLabel}`,
    });
  }

  if (
    watchdog?.enabled === true &&
    runtimeInstalled &&
    runtimeLoaded === true &&
    watchdog.launchAgentInstalled === false
  ) {
    diagnostics.push({
      level: "warn",
      message: `Runtime watchdog is enabled but no LaunchAgent exists at ${watchdogPlistPath}.`,
    });
  } else if (
    watchdog?.enabled === true &&
    watchdog.launchAgentInstalled &&
    watchdogLoaded === false
  ) {
    diagnostics.push({
      level: "warn",
      message: `Runtime watchdog LaunchAgent exists but is not loaded: ${watchdog.label}`,
    });
  }

  if (watchdog) {
    const watchdogDiagnostic = createRuntimeWatchdogDiagnostic(watchdog);
    if (watchdogDiagnostic) {
      diagnostics.push(watchdogDiagnostic);
    }
  }

  if (!input.configPath) {
    diagnostics.push({
      level: "warn",
      message: "No builder config path was resolved.",
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    ...(input.configPath ? { builderConfigPath: input.configPath } : {}),
    runtime: {
      ...(runtimeBinaryPath ? { singBoxBinary: runtimeBinaryPath } : {}),
      ...(runtimeBinarySource ? { binarySource: runtimeBinarySource } : {}),
      processRunning,
      processIds,
      ...(mode ? { mode } : {}),
      ...(desktopProfile ? { desktopProfile } : {}),
      runtimeLabel,
      launchAgentInstalled: runtimeInstalled,
      ...(runtimeLoaded !== undefined ? { launchAgentLoaded: runtimeLoaded } : {}),
      ...(systemProxyActive !== undefined ? { systemProxyActive } : {}),
      ...(systemProxy ? { systemProxy } : {}),
      ...(watchdog ? { watchdog } : {}),
      ...(tunInterfacePresent !== undefined ? { tunInterfacePresent } : {}),
      listeners,
    },
    config: {
      ...(input.config?.output.stagingPath ? { stagingPath: input.config.output.stagingPath } : {}),
      ...(input.config?.output.livePath ? { livePath: input.config.output.livePath } : {}),
      ...(input.config?.output.backupPath ? { backupPath: input.config.output.backupPath } : {}),
      liveExists,
    },
    scheduler: {
      enabled: input.config?.schedule.enabled ?? false,
      label: schedulerLabel,
      installed,
      ...(loaded !== undefined ? { loaded } : {}),
      plistPath,
    },
    history: {
      ...(latestTransaction?.txId ? { lastTransactionId: latestTransaction.txId } : {}),
      ...(latestTransaction?.status ? { lastTransactionStatus: latestTransaction.status } : {}),
      ...(latestTransaction?.startedAt ? { lastTransactionAt: latestTransaction.startedAt } : {}),
    },
    diagnostics,
  };
}

export async function collectSystemProxyRuntimeSnapshot(
  config: BuilderConfig,
): Promise<SystemProxyRuntimeSnapshot> {
  const processName = config.runtime.reload.processName ?? "sing-box";
  const processIds = await listProcessIds(processName);
  const processRunning = processIds.length > 0;
  const listenerActive = await isTcpListenerActive(
    config.listeners.mixed.listen,
    config.listeners.mixed.port,
  );
  const actual = await readSystemProxyServices();

  return {
    processRunning,
    processIds,
    listenerActive,
    systemProxy: assessSystemProxyState({
      processRunning,
      listenerActive,
      expected: {
        host: config.listeners.mixed.listen,
        port: config.listeners.mixed.port,
      },
      ...(actual ? { actual } : {}),
    }),
  };
}

async function listProcessIds(processName: string): Promise<number[]> {
  return new Promise<number[]>((resolve, reject) => {
    const child = spawn("/usr/bin/pgrep", ["-x", processName], {
      stdio: ["ignore", "pipe", "ignore"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        resolve([]);
        return;
      }

      resolve(
        stdout
          .split("\n")
          .map((line) => Number.parseInt(line.trim(), 10))
          .filter((value) => Number.isInteger(value) && value > 0),
      );
    });
  });
}

async function isTcpListenerActive(host: string, port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 400);

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function isLaunchAgentLoaded(label: string): Promise<boolean> {
  if (typeof process.getuid !== "function") {
    return false;
  }
  const uid = process.getuid();

  return new Promise<boolean>((resolve, reject) => {
    const child = spawn("/bin/launchctl", ["print", `gui/${uid}/${label}`], {
      stdio: ["ignore", "ignore", "ignore"],
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code === 0));
  });
}

export function assessSystemProxyState(input: {
  readonly processRunning: boolean;
  readonly listenerActive: boolean;
  readonly expected: StatusProxyEndpoint;
  readonly actual?: readonly StatusSystemProxyService[];
}): StatusSystemProxyState {
  if (input.processRunning && !input.listenerActive) {
    return {
      expected: input.expected,
      actual: input.actual ?? [],
      state: "listener-missing",
      drift: true,
      nextAction: "Run `singbox-iac restart` to restore the in-mixed listener.",
    };
  }

  if (!input.actual) {
    return {
      expected: input.expected,
      actual: [],
      state: "unknown",
      ...(input.processRunning
        ? {
            nextAction: "Inspect the current macOS proxy state with `scutil --proxy`.",
          }
        : {}),
    };
  }

  const enabledServices = input.actual.filter((service) => service.enabled);
  if (enabledServices.length === 0) {
    return {
      expected: input.expected,
      actual: input.actual,
      state: "inactive",
      drift: input.processRunning,
      ...(input.processRunning
        ? {
            nextAction:
              "Run `singbox-iac restart` to let sing-box reassert the macOS system proxy.",
          }
        : {}),
    };
  }

  const allEnabledServicesMatch = enabledServices.every((service) =>
    doesSystemProxyServiceMatchExpected(service, input.expected),
  );
  if (allEnabledServicesMatch) {
    return {
      expected: input.expected,
      actual: input.actual,
      state: "active",
      drift: false,
    };
  }

  return {
    expected: input.expected,
    actual: input.actual,
    state: "endpoint-mismatch",
    drift: input.processRunning,
    ...(input.processRunning
      ? {
          nextAction:
            "Run `singbox-iac restart` or disable the conflicting proxy app before retrying.",
        }
      : {}),
  };
}

async function readSystemProxyServices(): Promise<readonly StatusSystemProxyService[] | undefined> {
  return new Promise<readonly StatusSystemProxyService[] | undefined>((resolve) => {
    const child = spawn("/usr/sbin/scutil", ["--proxy"], {
      stdio: ["ignore", "pipe", "ignore"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.on("error", () => resolve(undefined));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(undefined);
        return;
      }

      const values = new Map<string, string>();
      for (const line of stdout.split("\n")) {
        const match = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*(.+?)\s*$/);
        if (match?.[1] && match[2]) {
          values.set(match[1], match[2]);
        }
      }

      resolve([
        createSystemProxyService(values, "http", "HTTPEnable", "HTTPProxy", "HTTPPort"),
        createSystemProxyService(values, "https", "HTTPSEnable", "HTTPSProxy", "HTTPSPort"),
        createSystemProxyService(values, "socks", "SOCKSEnable", "SOCKSProxy", "SOCKSPort"),
      ]);
    });
  });
}

function createSystemProxyDiagnostic(
  systemProxy: StatusSystemProxyState,
): StatusDiagnostic | undefined {
  switch (systemProxy.state) {
    case "inactive":
      return {
        level: "warn",
        message:
          `Desktop runtime is running in system-proxy mode, but no macOS system proxy is enabled. Expected ${formatProxyEndpoint(systemProxy.expected)}. ${systemProxy.nextAction ?? ""}`.trim(),
      };
    case "endpoint-mismatch":
      return {
        level: "warn",
        message:
          `Desktop runtime is running in system-proxy mode, but macOS proxy state is ${formatSystemProxyServices(systemProxy.actual)} instead of ${formatProxyEndpoint(systemProxy.expected)}. ${systemProxy.nextAction ?? ""}`.trim(),
      };
    case "listener-missing":
      return {
        level: "warn",
        message:
          `Desktop runtime is running in system-proxy mode, but in-mixed is not accepting connections on ${formatProxyEndpoint(systemProxy.expected)}. ${systemProxy.nextAction ?? ""}`.trim(),
      };
    case "unknown":
      return {
        level: "warn",
        message:
          `Desktop runtime is running in system-proxy mode, but the current macOS proxy state could not be inspected. ${systemProxy.nextAction ?? ""}`.trim(),
      };
    case "active":
      return undefined;
  }
}

function createRuntimeWatchdogDiagnostic(
  watchdog: StatusRuntimeWatchdog,
): StatusDiagnostic | undefined {
  switch (watchdog.lastResult) {
    case "restarted":
      return {
        level: "info",
        message:
          `Runtime watchdog last restarted the desktop runtime${watchdog.lastRestartAt ? ` at ${watchdog.lastRestartAt}` : ""}${watchdog.lastTrigger ? ` after ${watchdog.lastTrigger}` : ""}.`.trim(),
      };
    case "reasserted":
      return {
        level: "info",
        message:
          `Runtime watchdog last reasserted the macOS system proxy${watchdog.lastReassertAt ? ` at ${watchdog.lastReassertAt}` : ""}${watchdog.lastTrigger ? ` after ${watchdog.lastTrigger}` : ""}.`.trim(),
      };
    case "restart-skipped-cooldown":
    case "restart-failed":
      return {
        level: "warn",
        message: watchdog.lastMessage ?? "Runtime watchdog recovery needs attention.",
      };
    default:
      return undefined;
  }
}

function createSystemProxyService(
  values: ReadonlyMap<string, string>,
  kind: StatusSystemProxyService["kind"],
  enableKey: string,
  hostKey: string,
  portKey: string,
): StatusSystemProxyService {
  const host = values.get(hostKey);
  const parsedPort = Number.parseInt(values.get(portKey) ?? "", 10);

  return {
    kind,
    enabled: values.get(enableKey) === "1",
    ...(host ? { host } : {}),
    ...(Number.isInteger(parsedPort) && parsedPort > 0 ? { port: parsedPort } : {}),
  };
}

function doesSystemProxyServiceMatchExpected(
  service: StatusSystemProxyService,
  expected: StatusProxyEndpoint,
): boolean {
  return service.host === expected.host && service.port === expected.port;
}

function formatProxyEndpoint(endpoint: StatusProxyEndpoint): string {
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

async function isTunInterfacePresent(interfaceName?: string): Promise<boolean | undefined> {
  const args = interfaceName ? [interfaceName] : [];
  return new Promise<boolean | undefined>((resolve) => {
    const child = spawn("/sbin/ifconfig", args, {
      stdio: ["ignore", "pipe", "ignore"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.on("error", () => resolve(undefined));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(false);
        return;
      }

      if (interfaceName) {
        resolve(stdout.includes(`${interfaceName}:`) || stdout.startsWith(`${interfaceName}:`));
        return;
      }

      resolve(/\butun\d+:/.test(stdout));
    });
  });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
