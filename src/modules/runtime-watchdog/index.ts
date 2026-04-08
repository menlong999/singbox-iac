import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { BuilderConfig } from "../../config/schema.js";
import {
  type RuntimeAgentRecoverInput,
  type RuntimeAgentRecoverResult,
  recoverDesktopRuntimeAgent,
} from "../desktop-runtime/index.js";
import {
  type SystemProxyRuntimeSnapshot,
  collectSystemProxyRuntimeSnapshot,
} from "../system-proxy/index.js";

export interface RuntimeWatchdogAgentInstallInput {
  readonly configPath: string;
  readonly cliEntrypoint: string;
  readonly intervalSeconds: number;
  readonly label?: string;
  readonly launchAgentsDir?: string;
  readonly logsDir?: string;
  readonly workingDirectory?: string;
  readonly force?: boolean;
  readonly load?: boolean;
}

export interface RuntimeWatchdogAgentInstallResult {
  readonly label: string;
  readonly plistPath: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
}

export interface RuntimeWatchdogAgentRemoveInput {
  readonly label?: string;
  readonly launchAgentsDir?: string;
  readonly unload?: boolean;
}

export interface RuntimeWatchdogState {
  readonly version: 1;
  readonly label: string;
  readonly lastCheckedAt: string;
  readonly lastResult:
    | "healthy"
    | "reasserted"
    | "restarted"
    | "process-missing"
    | "listener-missing"
    | "proxy-unknown"
    | "reassert-failed"
    | "restart-failed"
    | "restart-skipped-cooldown"
    | "disabled"
    | "unsupported-profile";
  readonly lastMessage: string;
  readonly lastTrigger?: RuntimeWatchdogTrigger;
  readonly lastRecoveryAction?: RuntimeWatchdogRecoveryAction;
  readonly lastReassertAt?: string;
  readonly lastRestartAt?: string;
  readonly lastError?: string;
}

export interface RunRuntimeWatchdogTickInput {
  readonly config: BuilderConfig;
  readonly configPath: string;
  readonly snapshotCollector?: (config: BuilderConfig) => Promise<SystemProxyRuntimeSnapshot>;
  readonly commandRunner?: RuntimeCommandRunner;
  readonly runtimeAgentRecoverer?: RuntimeAgentRecoverer;
  readonly runtimeLaunchAgentsDir?: string;
  readonly statePath?: string;
}

export interface RunRuntimeWatchdogTickResult {
  readonly statePath: string;
  readonly state: RuntimeWatchdogState;
}

export interface RuntimeCommandRunnerResult {
  readonly stdout: string;
  readonly stderr: string;
}

export type RuntimeCommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<RuntimeCommandRunnerResult>;

export type RuntimeWatchdogTrigger = "process-missing" | "listener-missing" | "proxy-drift";

export type RuntimeWatchdogRecoveryAction = "reassert-proxy" | "restart-runtime";

export type RuntimeAgentRecoverer = (
  input: RuntimeAgentRecoverInput,
) => Promise<RuntimeAgentRecoverResult>;

export const defaultRuntimeWatchdogLaunchAgentLabel = "org.singbox-iac.runtime.watchdog";
export const defaultRuntimeWatchdogRestartCooldownMs = 5 * 60 * 1000;

export async function installRuntimeWatchdogAgent(
  input: RuntimeWatchdogAgentInstallInput,
): Promise<RuntimeWatchdogAgentInstallResult> {
  const label = input.label ?? defaultRuntimeWatchdogLaunchAgentLabel;
  const launchAgentsDir = input.launchAgentsDir ?? path.join(homedir(), "Library", "LaunchAgents");
  const logsDir = input.logsDir ?? path.join(homedir(), ".config", "singbox-iac", "logs");
  const plistPath = path.join(launchAgentsDir, `${label}.plist`);
  const stdoutPath = path.join(logsDir, `${label}.stdout.log`);
  const stderrPath = path.join(logsDir, `${label}.stderr.log`);

  if (input.force !== true && (await pathExists(plistPath))) {
    throw new Error(`Runtime watchdog LaunchAgent already exists: ${plistPath}`);
  }

  await mkdir(launchAgentsDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });

  if (input.load !== false) {
    await runLaunchctl(["bootout", launchctlDomainService(label)], true);
  }

  const workingDirectory = input.workingDirectory ?? process.cwd();
  const programArguments = resolveWatchdogProgramArguments({
    cliEntrypoint: path.resolve(input.cliEntrypoint),
    configPath: path.resolve(input.configPath),
    workingDirectory,
  });

  const plist = renderRuntimeWatchdogLaunchAgentPlist({
    label,
    intervalSeconds: input.intervalSeconds,
    workingDirectory,
    stdoutPath,
    stderrPath,
    programArguments,
  });

  await writeFile(plistPath, plist, "utf8");

  if (input.load !== false) {
    await runLaunchctl(["bootstrap", launchctlDomain(), plistPath]);
  }

  return {
    label,
    plistPath,
    stdoutPath,
    stderrPath,
  };
}

export async function removeRuntimeWatchdogAgent(
  input: RuntimeWatchdogAgentRemoveInput,
): Promise<string> {
  const label = input.label ?? defaultRuntimeWatchdogLaunchAgentLabel;
  const launchAgentsDir = input.launchAgentsDir ?? path.join(homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(launchAgentsDir, `${label}.plist`);

  if (input.unload !== false) {
    await runLaunchctl(["bootout", launchctlDomainService(label)], true);
  }

  await rm(plistPath, { force: true });
  return plistPath;
}

export function renderRuntimeWatchdogLaunchAgentPlist(input: {
  readonly label: string;
  readonly intervalSeconds: number;
  readonly workingDirectory: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly programArguments: readonly string[];
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(input.label)}</string>
  <key>ProgramArguments</key>
  <array>
${input.programArguments
  .map((argument) => `    <string>${escapeXml(argument)}</string>`)
  .join("\n")}
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(input.workingDirectory)}</string>
  <key>StartInterval</key>
  <integer>${input.intervalSeconds}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(input.stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(input.stderrPath)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${escapeXml(resolveLaunchdPath())}</string>
  </dict>
</dict>
</plist>
`;
}

export async function runRuntimeWatchdogTick(
  input: RunRuntimeWatchdogTickInput,
): Promise<RunRuntimeWatchdogTickResult> {
  const label = input.config.runtime.desktop.watchdog.launchAgentLabel;
  const runtimeLabel = input.config.runtime.desktop.launchAgentLabel;
  const statePath = input.statePath ?? resolveRuntimeWatchdogStatePath(label);
  const previousState = await readRuntimeWatchdogState(statePath);
  const now = new Date().toISOString();

  if (input.config.runtime.desktop.profile !== "system-proxy") {
    const state = await persistRuntimeWatchdogState(
      statePath,
      previousState,
      createRuntimeWatchdogState({
        previousState,
        label,
        now,
        lastResult: "unsupported-profile",
        lastMessage: `Watchdog skipped because desktop profile is ${input.config.runtime.desktop.profile}.`,
      }),
    );
    return { statePath, state };
  }

  if (input.config.runtime.desktop.watchdog.enabled !== true) {
    const state = await persistRuntimeWatchdogState(
      statePath,
      previousState,
      createRuntimeWatchdogState({
        previousState,
        label,
        now,
        lastResult: "disabled",
        lastMessage: "Watchdog is disabled in the builder config.",
      }),
    );
    return { statePath, state };
  }

  const collectSnapshot = input.snapshotCollector ?? collectSystemProxyRuntimeSnapshot;
  const commandRunner = input.commandRunner ?? runCommand;
  const runtimeAgentRecoverer = input.runtimeAgentRecoverer ?? recoverDesktopRuntimeAgent;
  const snapshot = await collectSnapshot(input.config);

  if (snapshot.systemProxy.state === "unknown") {
    const state = await persistRuntimeWatchdogState(
      statePath,
      previousState,
      createRuntimeWatchdogState({
        previousState,
        label,
        now,
        lastResult: "proxy-unknown",
        lastMessage: "The current macOS proxy state could not be inspected.",
      }),
    );
    return { statePath, state };
  }

  if (isHealthyRuntimeSnapshot(snapshot)) {
    const state = await persistRuntimeWatchdogState(
      statePath,
      previousState,
      createRuntimeWatchdogState({
        previousState,
        label,
        now,
        lastResult: "healthy",
        lastMessage: "Runtime and macOS proxy state are healthy.",
      }),
    );
    return { statePath, state };
  }

  const trigger = resolveRuntimeWatchdogTrigger(snapshot);
  if (!trigger) {
    const state = await persistRuntimeWatchdogState(
      statePath,
      previousState,
      createRuntimeWatchdogState({
        previousState,
        label,
        now,
        lastResult: "healthy",
        lastMessage: "Runtime and macOS proxy state are healthy.",
      }),
    );
    return { statePath, state };
  }

  if (trigger === "proxy-drift") {
    try {
      const services = await reassertSystemProxy({
        expected: snapshot.systemProxy.expected,
        commandRunner,
      });
      const verifiedSnapshot = await collectSnapshot(input.config);

      if (isHealthyRuntimeSnapshot(verifiedSnapshot)) {
        const state = await persistRuntimeWatchdogState(
          statePath,
          previousState,
          createRuntimeWatchdogState({
            previousState,
            label,
            now,
            lastResult: "reasserted",
            lastMessage: `Reasserted the macOS system proxy on ${services.length} network service(s).`,
            lastTrigger: trigger,
            lastRecoveryAction: "reassert-proxy",
            lastReassertAt: now,
          }),
        );
        return { statePath, state };
      }

      return attemptRuntimeRestart({
        config: input.config,
        now,
        label,
        runtimeLabel,
        trigger,
        reason: `Proxy drift is still present after reassert: ${describeRuntimeSnapshotProblem(verifiedSnapshot)}.`,
        statePath,
        previousState,
        collectSnapshot,
        runtimeAgentRecoverer,
        runtimeLaunchAgentsDir: input.runtimeLaunchAgentsDir,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return attemptRuntimeRestart({
        config: input.config,
        now,
        label,
        runtimeLabel,
        trigger,
        reason: `Failed to reassert the macOS system proxy: ${message}`,
        statePath,
        previousState,
        collectSnapshot,
        runtimeAgentRecoverer,
        runtimeLaunchAgentsDir: input.runtimeLaunchAgentsDir,
      });
    }
  }

  return attemptRuntimeRestart({
    config: input.config,
    now,
    label,
    runtimeLabel,
    trigger,
    reason: `Detected ${trigger}.`,
    statePath,
    previousState,
    collectSnapshot,
    runtimeAgentRecoverer,
    runtimeLaunchAgentsDir: input.runtimeLaunchAgentsDir,
  });
}

async function attemptRuntimeRestart(input: {
  readonly config: BuilderConfig;
  readonly now: string;
  readonly label: string;
  readonly runtimeLabel: string;
  readonly trigger: RuntimeWatchdogTrigger;
  readonly reason: string;
  readonly statePath: string;
  readonly previousState: RuntimeWatchdogState | undefined;
  readonly collectSnapshot: (config: BuilderConfig) => Promise<SystemProxyRuntimeSnapshot>;
  readonly runtimeAgentRecoverer: RuntimeAgentRecoverer;
  readonly runtimeLaunchAgentsDir: string | undefined;
}): Promise<RunRuntimeWatchdogTickResult> {
  if (isRestartCooldownActive(input.previousState?.lastRestartAt, input.now)) {
    const state = await persistRuntimeWatchdogState(
      input.statePath,
      input.previousState,
      createRuntimeWatchdogState({
        previousState: input.previousState,
        label: input.label,
        now: input.now,
        lastResult: "restart-skipped-cooldown",
        lastMessage: `Watchdog detected ${describeRuntimeWatchdogTrigger(input.trigger)}, but skipped runtime restart because the previous restart is still within the 5-minute cooldown.`,
        lastTrigger: input.trigger,
        lastError: input.reason,
      }),
    );
    return { statePath: input.statePath, state };
  }

  try {
    const recovery = await input.runtimeAgentRecoverer({
      label: input.runtimeLabel,
      ...(input.runtimeLaunchAgentsDir ? { launchAgentsDir: input.runtimeLaunchAgentsDir } : {}),
    });
    const verifiedSnapshot = await input.collectSnapshot(input.config);

    if (isHealthyRuntimeSnapshot(verifiedSnapshot)) {
      const state = await persistRuntimeWatchdogState(
        input.statePath,
        input.previousState,
        createRuntimeWatchdogState({
          previousState: input.previousState,
          label: input.label,
          now: input.now,
          lastResult: "restarted",
          lastMessage: `Restarted the desktop runtime via ${recovery.method} after ${describeRuntimeWatchdogTrigger(input.trigger)}.`,
          lastTrigger: input.trigger,
          lastRecoveryAction: "restart-runtime",
          lastRestartAt: input.now,
        }),
      );
      return { statePath: input.statePath, state };
    }

    const state = await persistRuntimeWatchdogState(
      input.statePath,
      input.previousState,
      createRuntimeWatchdogState({
        previousState: input.previousState,
        label: input.label,
        now: input.now,
        lastResult: "restart-failed",
        lastMessage: `Restarted the desktop runtime via ${recovery.method}, but verification still reports ${describeRuntimeSnapshotProblem(verifiedSnapshot)}.`,
        lastTrigger: input.trigger,
        lastRecoveryAction: "restart-runtime",
        lastRestartAt: input.now,
        lastError: `${input.reason} Recovery verification still reports ${describeRuntimeSnapshotProblem(verifiedSnapshot)}.`,
      }),
    );
    return { statePath: input.statePath, state };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const state = await persistRuntimeWatchdogState(
      input.statePath,
      input.previousState,
      createRuntimeWatchdogState({
        previousState: input.previousState,
        label: input.label,
        now: input.now,
        lastResult: "restart-failed",
        lastMessage: `Failed to restart the desktop runtime after ${describeRuntimeWatchdogTrigger(input.trigger)}.`,
        lastTrigger: input.trigger,
        lastError: `${input.reason} ${message}`.trim(),
      }),
    );
    return { statePath: input.statePath, state };
  }
}

function isHealthyRuntimeSnapshot(snapshot: SystemProxyRuntimeSnapshot): boolean {
  return (
    snapshot.processRunning && snapshot.listenerActive && snapshot.systemProxy.state === "active"
  );
}

function resolveRuntimeWatchdogTrigger(
  snapshot: SystemProxyRuntimeSnapshot,
): RuntimeWatchdogTrigger | undefined {
  if (!snapshot.processRunning) {
    return "process-missing";
  }

  if (snapshot.systemProxy.state === "listener-missing") {
    return "listener-missing";
  }

  if (
    snapshot.systemProxy.state === "inactive" ||
    snapshot.systemProxy.state === "endpoint-mismatch"
  ) {
    return "proxy-drift";
  }

  return undefined;
}

function describeRuntimeWatchdogTrigger(trigger: RuntimeWatchdogTrigger): string {
  switch (trigger) {
    case "process-missing":
      return "process-missing";
    case "listener-missing":
      return "listener-missing";
    case "proxy-drift":
      return "proxy-drift";
  }
}

function describeRuntimeSnapshotProblem(snapshot: SystemProxyRuntimeSnapshot): string {
  if (!snapshot.processRunning) {
    return "process-missing";
  }

  if (snapshot.systemProxy.state === "listener-missing") {
    return "listener-missing";
  }

  return snapshot.systemProxy.state;
}

function isRestartCooldownActive(previousRestartAt: string | undefined, now: string): boolean {
  if (!previousRestartAt) {
    return false;
  }

  const previousRestartMs = Date.parse(previousRestartAt);
  const nowMs = Date.parse(now);
  if (Number.isNaN(previousRestartMs) || Number.isNaN(nowMs)) {
    return false;
  }

  return nowMs - previousRestartMs < defaultRuntimeWatchdogRestartCooldownMs;
}

function createRuntimeWatchdogState(input: {
  readonly previousState: RuntimeWatchdogState | undefined;
  readonly label: string;
  readonly now: string;
  readonly lastResult: RuntimeWatchdogState["lastResult"];
  readonly lastMessage: string;
  readonly lastTrigger?: RuntimeWatchdogTrigger;
  readonly lastRecoveryAction?: RuntimeWatchdogRecoveryAction;
  readonly lastReassertAt?: string;
  readonly lastRestartAt?: string;
  readonly lastError?: string;
}): RuntimeWatchdogState {
  return {
    version: 1,
    label: input.label,
    lastCheckedAt: input.now,
    lastResult: input.lastResult,
    lastMessage: input.lastMessage,
    ...(input.lastTrigger ? { lastTrigger: input.lastTrigger } : {}),
    ...(input.lastRecoveryAction ? { lastRecoveryAction: input.lastRecoveryAction } : {}),
    ...(input.lastReassertAt
      ? { lastReassertAt: input.lastReassertAt }
      : input.previousState?.lastReassertAt
        ? { lastReassertAt: input.previousState.lastReassertAt }
        : {}),
    ...(input.lastRestartAt
      ? { lastRestartAt: input.lastRestartAt }
      : input.previousState?.lastRestartAt
        ? { lastRestartAt: input.previousState.lastRestartAt }
        : {}),
    ...(input.lastError ? { lastError: input.lastError } : {}),
  };
}

export async function readRuntimeWatchdogState(
  statePath: string,
): Promise<RuntimeWatchdogState | undefined> {
  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<RuntimeWatchdogState>;

    if (
      parsed.version !== 1 ||
      typeof parsed.label !== "string" ||
      typeof parsed.lastCheckedAt !== "string" ||
      typeof parsed.lastResult !== "string" ||
      typeof parsed.lastMessage !== "string"
    ) {
      return undefined;
    }

    return {
      version: 1,
      label: parsed.label,
      lastCheckedAt: parsed.lastCheckedAt,
      lastResult: parsed.lastResult as RuntimeWatchdogState["lastResult"],
      lastMessage: parsed.lastMessage,
      ...(typeof parsed.lastTrigger === "string"
        ? { lastTrigger: parsed.lastTrigger as RuntimeWatchdogTrigger }
        : {}),
      ...(typeof parsed.lastRecoveryAction === "string"
        ? { lastRecoveryAction: parsed.lastRecoveryAction as RuntimeWatchdogRecoveryAction }
        : {}),
      ...(typeof parsed.lastReassertAt === "string"
        ? { lastReassertAt: parsed.lastReassertAt }
        : {}),
      ...(typeof parsed.lastRestartAt === "string" ? { lastRestartAt: parsed.lastRestartAt } : {}),
      ...(typeof parsed.lastError === "string" ? { lastError: parsed.lastError } : {}),
    };
  } catch {
    return undefined;
  }
}

export function resolveRuntimeWatchdogStatePath(
  label = defaultRuntimeWatchdogLaunchAgentLabel,
): string {
  return path.join(homedir(), ".config", "singbox-iac", "runtime-watchdog", `${label}.json`);
}

async function writeRuntimeWatchdogState(
  statePath: string,
  state: RuntimeWatchdogState,
): Promise<RuntimeWatchdogState> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

async function persistRuntimeWatchdogState(
  statePath: string,
  previousState: RuntimeWatchdogState | undefined,
  nextState: RuntimeWatchdogState,
): Promise<RuntimeWatchdogState> {
  if (previousState && isSameRuntimeWatchdogState(previousState, nextState)) {
    return previousState;
  }

  return writeRuntimeWatchdogState(statePath, nextState);
}

function isSameRuntimeWatchdogState(
  left: RuntimeWatchdogState,
  right: RuntimeWatchdogState,
): boolean {
  return (
    left.version === right.version &&
    left.label === right.label &&
    left.lastResult === right.lastResult &&
    left.lastMessage === right.lastMessage &&
    left.lastTrigger === right.lastTrigger &&
    left.lastRecoveryAction === right.lastRecoveryAction &&
    left.lastReassertAt === right.lastReassertAt &&
    left.lastRestartAt === right.lastRestartAt &&
    left.lastError === right.lastError
  );
}

async function reassertSystemProxy(input: {
  readonly expected: { host: string; port: number };
  readonly commandRunner: RuntimeCommandRunner;
}): Promise<readonly string[]> {
  const services = await listEnabledNetworkServices(input.commandRunner);
  if (services.length === 0) {
    throw new Error("No enabled macOS network services were found for proxy reassert.");
  }

  for (const service of services) {
    await input.commandRunner("/usr/sbin/networksetup", [
      "-setwebproxy",
      service,
      input.expected.host,
      String(input.expected.port),
      "off",
    ]);
    await input.commandRunner("/usr/sbin/networksetup", [
      "-setsecurewebproxy",
      service,
      input.expected.host,
      String(input.expected.port),
      "off",
    ]);
    await input.commandRunner("/usr/sbin/networksetup", [
      "-setsocksfirewallproxy",
      service,
      input.expected.host,
      String(input.expected.port),
      "off",
    ]);
  }

  return services;
}

async function listEnabledNetworkServices(
  commandRunner: RuntimeCommandRunner,
): Promise<readonly string[]> {
  const result = await commandRunner("/usr/sbin/networksetup", ["-listallnetworkservices"]);

  return result.stdout
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("*"));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveWatchdogProgramArguments(input: {
  readonly cliEntrypoint: string;
  readonly configPath: string;
  readonly workingDirectory: string;
}): string[] {
  if (path.extname(input.cliEntrypoint) === ".ts") {
    const tsxBinary = path.resolve(input.workingDirectory, "node_modules", ".bin", "tsx");
    return [tsxBinary, input.cliEntrypoint, "runtime-watchdog", "--config", input.configPath];
  }

  return [process.execPath, input.cliEntrypoint, "runtime-watchdog", "--config", input.configPath];
}

function launchctlDomain(): string {
  if (typeof process.getuid !== "function") {
    throw new Error("runtime watchdog launchd control requires process.getuid().");
  }
  return `gui/${process.getuid()}`;
}

function launchctlDomainService(label: string): string {
  return `${launchctlDomain()}/${label}`;
}

async function runLaunchctl(args: readonly string[], allowFailure = false): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("/bin/launchctl", args, {
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
      if (code === 0 || allowFailure) {
        resolve();
        return;
      }

      const details = [stdout.trim(), stderr.trim()].filter((value) => value.length > 0).join("\n");
      reject(new Error(details || `launchctl ${args.join(" ")} failed`));
    });
  });
}

function resolveLaunchdPath(): string {
  const entries = [
    process.env.PATH,
    "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .flatMap((value) => value.split(path.delimiter));

  return [...new Set(entries)].join(path.delimiter);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function runCommand(
  command: string,
  args: readonly string[],
): Promise<RuntimeCommandRunnerResult> {
  return new Promise<RuntimeCommandRunnerResult>((resolve, reject) => {
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
