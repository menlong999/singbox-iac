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

  if (processRunning) {
    for (const listener of listeners.filter((entry) => !entry.active)) {
      diagnostics.push({
        level: "warn",
        message: `${listener.tag} is configured on ${listener.listen}:${listener.port} but is not accepting connections.`,
      });
    }
  }

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
  const systemProxyActive =
    desktopProfile === "system-proxy" && input.config
      ? await isSystemProxyActive(
          input.config.listeners.mixed.listen,
          input.config.listeners.mixed.port,
        )
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

  if (desktopProfile === "system-proxy" && processRunning && systemProxyActive === false) {
    diagnostics.push({
      level: "warn",
      message: "Desktop runtime is running, but the macOS system proxy does not point at in-mixed.",
    });
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

async function isSystemProxyActive(host: string, port: number): Promise<boolean | undefined> {
  return new Promise<boolean | undefined>((resolve) => {
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

      const httpEnabled = values.get("HTTPEnable") === "1";
      const socksEnabled = values.get("SOCKSEnable") === "1";
      const httpMatches =
        values.get("HTTPProxy") === host &&
        Number.parseInt(values.get("HTTPPort") ?? "", 10) === port;
      const socksMatches =
        values.get("SOCKSProxy") === host &&
        Number.parseInt(values.get("SOCKSPort") ?? "", 10) === port;

      resolve((httpEnabled && httpMatches) || (socksEnabled && socksMatches));
    });
  });
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
