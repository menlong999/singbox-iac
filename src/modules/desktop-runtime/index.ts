import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import YAML from "yaml";

import type { BuilderConfig } from "../../config/schema.js";
import type { DesktopRuntimeProfileKind } from "../../domain/runtime-mode.js";

export interface DesktopRuntimeProfile {
  readonly kind: DesktopRuntimeProfileKind;
  readonly tun?: {
    readonly autoRoute: boolean;
    readonly strictRoute: boolean;
    readonly interfaceName?: string;
    readonly addresses: readonly string[];
  };
}

export interface RuntimeAgentInstallInput {
  readonly liveConfigPath: string;
  readonly singBoxBinary: string;
  readonly label?: string;
  readonly launchAgentsDir?: string;
  readonly logsDir?: string;
  readonly workingDirectory?: string;
  readonly force?: boolean;
  readonly load?: boolean;
}

export interface RuntimeAgentInstallResult {
  readonly label: string;
  readonly plistPath: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
}

export interface RuntimeAgentRemoveInput {
  readonly label?: string;
  readonly launchAgentsDir?: string;
  readonly unload?: boolean;
}

export interface RuntimeAgentRestartInput {
  readonly label?: string;
}

export interface RuntimeAgentRecoverInput {
  readonly label?: string;
  readonly launchAgentsDir?: string;
}

export interface RuntimeAgentRecoverResult {
  readonly label: string;
  readonly plistPath: string;
  readonly method: "kickstart" | "bootstrap";
}

export const defaultRuntimeLaunchAgentLabel = "org.singbox-iac.runtime";
export const defaultRuntimeWatchdogLaunchAgentLabel = "org.singbox-iac.runtime.watchdog";

export function resolveDesktopRuntimeProfile(config: BuilderConfig): DesktopRuntimeProfile {
  if (config.runtime.desktop.profile === "tun") {
    return {
      kind: "tun",
      tun: {
        autoRoute: config.runtime.desktop.tun.autoRoute,
        strictRoute: config.runtime.desktop.tun.strictRoute,
        ...(config.runtime.desktop.tun.interfaceName
          ? { interfaceName: config.runtime.desktop.tun.interfaceName }
          : {}),
        addresses: config.runtime.desktop.tun.addresses,
      },
    };
  }

  return { kind: config.runtime.desktop.profile };
}

export async function updateBuilderDesktopRuntime(input: {
  readonly configPath: string;
  readonly profile: DesktopRuntimeProfileKind;
}): Promise<void> {
  const raw = await readFile(input.configPath, "utf8");
  const parsed = YAML.parse(raw) as BuilderConfig & Record<string, unknown>;

  parsed.runtime = {
    ...parsed.runtime,
    desktop: {
      ...(parsed.runtime?.desktop ?? {}),
      profile: input.profile,
      launchAgentLabel: parsed.runtime?.desktop?.launchAgentLabel ?? defaultRuntimeLaunchAgentLabel,
      tun: {
        ...(parsed.runtime?.desktop?.tun ?? {}),
        autoRoute: parsed.runtime?.desktop?.tun?.autoRoute ?? true,
        strictRoute: parsed.runtime?.desktop?.tun?.strictRoute ?? false,
        addresses: parsed.runtime?.desktop?.tun?.addresses ?? [
          "172.19.0.1/30",
          "fdfe:dcba:9876::1/126",
        ],
      },
      watchdog: {
        ...(parsed.runtime?.desktop?.watchdog ?? {}),
        enabled: parsed.runtime?.desktop?.watchdog?.enabled ?? true,
        intervalSeconds: parsed.runtime?.desktop?.watchdog?.intervalSeconds ?? 60,
        launchAgentLabel:
          parsed.runtime?.desktop?.watchdog?.launchAgentLabel ??
          defaultRuntimeWatchdogLaunchAgentLabel,
      },
    },
  };

  await writeFile(input.configPath, YAML.stringify(parsed), "utf8");
}

export async function installDesktopRuntimeAgent(
  input: RuntimeAgentInstallInput,
): Promise<RuntimeAgentInstallResult> {
  const label = input.label ?? defaultRuntimeLaunchAgentLabel;
  const launchAgentsDir = input.launchAgentsDir ?? path.join(homedir(), "Library", "LaunchAgents");
  const logsDir = input.logsDir ?? path.join(homedir(), ".config", "singbox-iac", "logs");
  const plistPath = path.join(launchAgentsDir, `${label}.plist`);
  const stdoutPath = path.join(logsDir, `${label}.stdout.log`);
  const stderrPath = path.join(logsDir, `${label}.stderr.log`);

  if (input.force !== true && (await pathExists(plistPath))) {
    throw new Error(`Runtime LaunchAgent already exists: ${plistPath}`);
  }

  await mkdir(launchAgentsDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });

  if (input.load !== false) {
    await runLaunchctl(["bootout", launchctlDomainService(label)], true);
  }

  const workingDirectory = input.workingDirectory ?? process.cwd();
  const plist = renderRuntimeLaunchAgentPlist({
    label,
    workingDirectory,
    stdoutPath,
    stderrPath,
    liveConfigPath: path.resolve(input.liveConfigPath),
    singBoxBinary: path.resolve(input.singBoxBinary),
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

export async function removeDesktopRuntimeAgent(input: RuntimeAgentRemoveInput): Promise<string> {
  const label = input.label ?? defaultRuntimeLaunchAgentLabel;
  const launchAgentsDir = input.launchAgentsDir ?? path.join(homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(launchAgentsDir, `${label}.plist`);

  if (input.unload !== false) {
    await runLaunchctl(["bootout", launchctlDomainService(label)], true);
  }

  await rm(plistPath, { force: true });
  return plistPath;
}

export async function restartDesktopRuntimeAgent(input: RuntimeAgentRestartInput): Promise<string> {
  const label = input.label ?? defaultRuntimeLaunchAgentLabel;
  await runLaunchctl(["kickstart", "-k", launchctlDomainService(label)]);
  return label;
}

export async function recoverDesktopRuntimeAgent(
  input: RuntimeAgentRecoverInput,
): Promise<RuntimeAgentRecoverResult> {
  const label = input.label ?? defaultRuntimeLaunchAgentLabel;
  const launchAgentsDir = input.launchAgentsDir ?? path.join(homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(launchAgentsDir, `${label}.plist`);

  if (!(await pathExists(plistPath))) {
    throw new Error(`Runtime LaunchAgent does not exist: ${plistPath}`);
  }

  try {
    await runLaunchctl(["kickstart", "-k", launchctlDomainService(label)]);
    return {
      label,
      plistPath,
      method: "kickstart",
    };
  } catch (kickstartError) {
    try {
      await runLaunchctl(["bootstrap", launchctlDomain(), plistPath]);
      return {
        label,
        plistPath,
        method: "bootstrap",
      };
    } catch (bootstrapError) {
      const details = [
        kickstartError instanceof Error ? `kickstart: ${kickstartError.message}` : undefined,
        bootstrapError instanceof Error ? `bootstrap: ${bootstrapError.message}` : undefined,
      ].filter((value): value is string => Boolean(value));
      throw new Error(details.join("\n") || `Failed to recover runtime LaunchAgent: ${label}`);
    }
  }
}

export function renderRuntimeLaunchAgentPlist(input: {
  readonly label: string;
  readonly workingDirectory: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly singBoxBinary: string;
  readonly liveConfigPath: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(input.label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(input.singBoxBinary)}</string>
    <string>run</string>
    <string>-c</string>
    <string>${escapeXml(input.liveConfigPath)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(input.workingDirectory)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
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

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function launchctlDomain(): string {
  if (typeof process.getuid !== "function") {
    throw new Error("desktop runtime launchd control requires process.getuid().");
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
