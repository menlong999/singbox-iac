import { spawn } from "node:child_process";
import net from "node:net";

import type { BuilderConfig } from "../../config/schema.js";

export interface SystemProxyEndpoint {
  readonly host: string;
  readonly port: number;
}

export interface SystemProxyService {
  readonly kind: "http" | "https" | "socks";
  readonly enabled: boolean;
  readonly host?: string;
  readonly port?: number;
}

export interface SystemProxyState {
  readonly expected: SystemProxyEndpoint;
  readonly actual: readonly SystemProxyService[];
  readonly state: "active" | "inactive" | "endpoint-mismatch" | "listener-missing" | "unknown";
  readonly drift?: boolean;
  readonly nextAction?: string;
}

export interface SystemProxyRuntimeSnapshot {
  readonly processRunning: boolean;
  readonly processIds: readonly number[];
  readonly listenerActive: boolean;
  readonly systemProxy: SystemProxyState;
}

export function assessSystemProxyState(input: {
  readonly processRunning: boolean;
  readonly listenerActive: boolean;
  readonly expected: SystemProxyEndpoint;
  readonly actual?: readonly SystemProxyService[];
}): SystemProxyState {
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

async function readSystemProxyServices(): Promise<readonly SystemProxyService[] | undefined> {
  return new Promise<readonly SystemProxyService[] | undefined>((resolve) => {
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

function createSystemProxyService(
  values: ReadonlyMap<string, string>,
  kind: SystemProxyService["kind"],
  enableKey: string,
  hostKey: string,
  portKey: string,
): SystemProxyService {
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
  service: SystemProxyService,
  expected: SystemProxyEndpoint,
): boolean {
  return service.host === expected.host && service.port === expected.port;
}
