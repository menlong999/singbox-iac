import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import net from "node:net";

import type { BuilderConfig } from "../../config/schema.js";
import {
  type StatusInput,
  type StatusReport,
  type StatusSystemProxyService,
  collectStatusReport,
} from "../status/index.js";

export interface DiagnosticsInput extends StatusInput {
  readonly statusCollector?: (input: StatusInput) => Promise<StatusReport>;
  readonly commandRunner?: DiagnosticsCommandRunner;
  readonly dnsLookup?: (hostname: string) => Promise<readonly string[]>;
}

export interface DiagnosticsCheck {
  readonly status: "PASS" | "WARN" | "FAIL";
  readonly name: string;
  readonly details: string;
}

export interface DiagnosticsReport {
  readonly generatedAt: string;
  readonly builderConfigPath?: string;
  readonly summary: {
    readonly pass: number;
    readonly warn: number;
    readonly fail: number;
  };
  readonly checks: readonly DiagnosticsCheck[];
  readonly status: StatusReport;
}

export interface DiagnosticsCommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

export type DiagnosticsCommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<DiagnosticsCommandResult>;

export async function collectDiagnosticsReport(
  input: DiagnosticsInput,
): Promise<DiagnosticsReport> {
  const statusCollector = input.statusCollector ?? collectStatusReport;
  const status = await statusCollector({
    ...(input.config ? { config: input.config } : {}),
    ...(input.configPath ? { configPath: input.configPath } : {}),
    ...(input.singBoxBinary ? { singBoxBinary: input.singBoxBinary } : {}),
    ...(input.launchAgentsDir ? { launchAgentsDir: input.launchAgentsDir } : {}),
    ...(input.label ? { label: input.label } : {}),
    ...(input.runtimeLabel ? { runtimeLabel: input.runtimeLabel } : {}),
  });
  const commandRunner = input.commandRunner ?? runCommand;
  const dnsLookup = input.dnsLookup ?? lookupHostnameAddresses;

  const checks: DiagnosticsCheck[] = [
    createRuntimeProcessCheck(status),
    ...createListenerChecks(status),
    ...(status.runtime.systemProxy ? [createSystemProxyCheck(status)] : []),
    createLiveConfigCheck(status),
    createScheduleCheck(status),
    createTransactionCheck(status),
    ...(await createLocalNetworkChecks({
      ...(input.config ? { config: input.config } : {}),
      status,
      commandRunner,
      dnsLookup,
    })),
  ];

  return {
    generatedAt: new Date().toISOString(),
    ...(status.builderConfigPath ? { builderConfigPath: status.builderConfigPath } : {}),
    summary: summarizeChecks(checks),
    checks,
    status,
  };
}

function createRuntimeProcessCheck(status: StatusReport): DiagnosticsCheck {
  return {
    status: status.runtime.processRunning ? "PASS" : "WARN",
    name: "runtime-process",
    details: status.runtime.processRunning
      ? `running${status.runtime.processIds.length > 0 ? ` (${status.runtime.processIds.join(", ")})` : ""}`
      : `stopped (label=${status.runtime.runtimeLabel})`,
  };
}

function createListenerChecks(status: StatusReport): DiagnosticsCheck[] {
  return status.runtime.listeners.map((listener) => ({
    status: listener.active ? "PASS" : "WARN",
    name: `listener:${listener.tag}`,
    details: `${listener.listen}:${listener.port} ${listener.active ? "accepting connections" : "not accepting connections"}`,
  }));
}

function createSystemProxyCheck(status: StatusReport): DiagnosticsCheck {
  const systemProxy = status.runtime.systemProxy;
  if (!systemProxy) {
    return makeCheck("WARN", "system-proxy", "Desktop runtime is not in system-proxy mode.");
  }

  const actual = formatSystemProxyServices(systemProxy.actual);
  if (systemProxy.state === "active") {
    return makeCheck(
      "PASS",
      "system-proxy",
      `active at ${formatProxyEndpoint(systemProxy.expected)} (${actual})`,
    );
  }

  return makeCheck(
    "WARN",
    "system-proxy",
    `state=${systemProxy.state}, expected=${formatProxyEndpoint(systemProxy.expected)}, actual=${actual}${systemProxy.nextAction ? `, hint=${systemProxy.nextAction}` : ""}`,
  );
}

function createLiveConfigCheck(status: StatusReport): DiagnosticsCheck {
  return makeCheck(
    status.config.liveExists ? "PASS" : "WARN",
    "live-config",
    status.config.livePath
      ? `${status.config.livePath}${status.config.liveExists ? " [present]" : " [missing]"}`
      : "(unset)",
  );
}

function createScheduleCheck(status: StatusReport): DiagnosticsCheck {
  if (!status.scheduler.enabled) {
    return makeCheck(
      "PASS",
      "schedule",
      `disabled in builder config (label=${status.scheduler.label})`,
    );
  }

  if (!status.scheduler.installed) {
    return makeCheck(
      "WARN",
      "schedule",
      `enabled in builder config but no LaunchAgent exists at ${status.scheduler.plistPath}`,
    );
  }

  return makeCheck(
    status.scheduler.loaded === false ? "WARN" : "PASS",
    "schedule",
    `${status.scheduler.label} installed${status.scheduler.loaded !== undefined ? ` loaded=${String(status.scheduler.loaded)}` : ""}`,
  );
}

function createTransactionCheck(status: StatusReport): DiagnosticsCheck {
  if (!status.history.lastTransactionId) {
    return makeCheck("WARN", "latest-transaction", "No publish transaction was recorded.");
  }

  const transactionDetails = `${status.history.lastTransactionId} ${status.history.lastTransactionStatus ?? "unknown"}${status.history.lastTransactionAt ? ` at ${status.history.lastTransactionAt}` : ""}`;
  return makeCheck(
    status.history.lastTransactionStatus === "applied" ? "PASS" : "WARN",
    "latest-transaction",
    transactionDetails,
  );
}

async function createLocalNetworkChecks(input: {
  readonly config?: BuilderConfig;
  readonly status: StatusReport;
  readonly commandRunner: DiagnosticsCommandRunner;
  readonly dnsLookup: (hostname: string) => Promise<readonly string[]>;
}): Promise<readonly DiagnosticsCheck[]> {
  const checks: DiagnosticsCheck[] = [];
  checks.push(await createDefaultRouteCheck(input.commandRunner));
  checks.push(await createSystemDnsCheck(input.commandRunner));

  for (const hostname of selectDiagnosticHostnames(input.config)) {
    checks.push(await createDnsProbeCheck(hostname, input.status, input.dnsLookup));
  }

  return checks;
}

async function createDefaultRouteCheck(
  commandRunner: DiagnosticsCommandRunner,
): Promise<DiagnosticsCheck> {
  try {
    const result = await runCommandWithFallback(
      commandRunner,
      ["/usr/sbin/route", "/sbin/route"],
      ["-n", "get", "default"],
    );
    const gateway = matchCommandValue(result.stdout, "gateway");
    const networkInterface = matchCommandValue(result.stdout, "interface");

    if (!gateway || !networkInterface) {
      return makeCheck(
        "WARN",
        "default-route",
        "Default route output was present, but gateway or interface could not be parsed.",
      );
    }

    return makeCheck("PASS", "default-route", `interface=${networkInterface}, gateway=${gateway}`);
  } catch (error) {
    return makeCheck(
      "WARN",
      "default-route",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function runCommandWithFallback(
  commandRunner: DiagnosticsCommandRunner,
  commands: readonly string[],
  args: readonly string[],
): Promise<DiagnosticsCommandResult> {
  let lastError: unknown;
  for (const command of commands) {
    try {
      return await commandRunner(command, args);
    } catch (error) {
      lastError = error;
      if (!isCommandMissingError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No executable command candidates succeeded.");
}

async function createSystemDnsCheck(
  commandRunner: DiagnosticsCommandRunner,
): Promise<DiagnosticsCheck> {
  try {
    const result = await commandRunner("/usr/sbin/scutil", ["--dns"]);
    const nameservers = parseSystemDnsNameservers(result.stdout);
    if (nameservers.length === 0) {
      return makeCheck("WARN", "system-dns", "No nameservers were parsed from `scutil --dns`.");
    }

    return makeCheck("PASS", "system-dns", `nameservers=${nameservers.slice(0, 4).join(", ")}`);
  } catch (error) {
    return makeCheck("WARN", "system-dns", error instanceof Error ? error.message : String(error));
  }
}

async function createDnsProbeCheck(
  hostname: string,
  status: StatusReport,
  dnsLookup: (hostname: string) => Promise<readonly string[]>,
): Promise<DiagnosticsCheck> {
  try {
    const addresses = [...new Set(await dnsLookup(hostname))];
    if (addresses.length === 0) {
      return makeCheck("WARN", `dns-probe:${hostname}`, "Lookup returned no addresses.");
    }

    const onlySuspiciousAddresses = addresses.every(isSuspiciousPublicAddress);
    if (onlySuspiciousAddresses) {
      return makeCheck(
        "WARN",
        `dns-probe:${hostname}`,
        `Resolved only suspicious addresses: ${addresses.join(", ")}`,
      );
    }

    return makeCheck(
      "PASS",
      `dns-probe:${hostname}`,
      `resolved ${addresses.slice(0, 3).join(", ")}${addresses.length > 3 ? ` (+${addresses.length - 3} more)` : ""}`,
    );
  } catch (error) {
    const suffix =
      status.runtime.systemProxy?.state === "active"
        ? " while runtime proxy state is healthy."
        : ".";
    return makeCheck(
      "WARN",
      `dns-probe:${hostname}`,
      `${error instanceof Error ? error.message : String(error)}${suffix}`,
    );
  }
}

async function lookupHostnameAddresses(hostname: string): Promise<readonly string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function selectDiagnosticHostnames(config?: BuilderConfig): readonly string[] {
  if (!config) {
    return [];
  }

  const hostnames = config.verification.scenarios
    .map((scenario) => {
      try {
        return new URL(scenario.url).hostname;
      } catch {
        return undefined;
      }
    })
    .filter((value): value is string => Boolean(value));

  return [...new Set(hostnames)].slice(0, 3);
}

function summarizeChecks(checks: readonly DiagnosticsCheck[]): DiagnosticsReport["summary"] {
  const summary = {
    pass: 0,
    warn: 0,
    fail: 0,
  };

  for (const check of checks) {
    if (check.status === "PASS") {
      summary.pass += 1;
      continue;
    }
    if (check.status === "WARN") {
      summary.warn += 1;
      continue;
    }
    summary.fail += 1;
  }

  return summary;
}

function makeCheck(
  status: DiagnosticsCheck["status"],
  name: string,
  details: string,
): DiagnosticsCheck {
  return { status, name, details };
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
    .map((service) =>
      service.host && typeof service.port === "number"
        ? `${service.kind}=${service.host}:${service.port}`
        : `${service.kind}=(incomplete)`,
    )
    .join(", ");
}

function parseSystemDnsNameservers(stdout: string): readonly string[] {
  const nameservers = stdout
    .split("\n")
    .map((line) => line.match(/nameserver\[[0-9]+\]\s*:\s*(.+?)\s*$/)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));

  return [...new Set(nameservers)];
}

function matchCommandValue(stdout: string, key: string): string | undefined {
  return stdout
    .split("\n")
    .map((line) => line.match(new RegExp(`^\\s*${key}:\\s*(.+?)\\s*$`))?.[1]?.trim())
    .find((value): value is string => Boolean(value));
}

function isCommandMissingError(error: unknown): boolean {
  if (error instanceof Error) {
    const commandError = error as Error & { code?: string };
    return commandError.code === "ENOENT" || error.message.includes("ENOENT");
  }
  return false;
}

function isSuspiciousPublicAddress(address: string): boolean {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) {
    const octets = address.split(".").map((part) => Number.parseInt(part, 10));
    if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
      return true;
    }

    const a = octets[0] ?? -1;
    const b = octets[1] ?? -1;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  if (ipVersion === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return true;
}

async function runCommand(
  command: string,
  args: readonly string[],
): Promise<DiagnosticsCommandResult> {
  return new Promise<DiagnosticsCommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const details = [stdout.trim(), stderr.trim()].filter((value) => value.length > 0).join("\n");
      reject(new Error(details || `Command failed: ${command} ${args.join(" ")}`));
    });
  });
}
