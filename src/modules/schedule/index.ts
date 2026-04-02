import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export interface ScheduleInstallInput {
  readonly configPath: string;
  readonly intervalMinutes: number;
  readonly cliEntrypoint: string;
  readonly label?: string;
  readonly launchAgentsDir?: string;
  readonly workingDirectory?: string;
  readonly logsDir?: string;
  readonly singBoxBinary?: string;
  readonly chromeBinary?: string;
  readonly force?: boolean;
  readonly load?: boolean;
}

export interface ScheduleInstallResult {
  readonly label: string;
  readonly plistPath: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
}

export interface ScheduleRemoveInput {
  readonly label?: string;
  readonly launchAgentsDir?: string;
  readonly unload?: boolean;
}

export const defaultLaunchAgentLabel = "org.singbox-iac.update";

export async function installLaunchdSchedule(
  input: ScheduleInstallInput,
): Promise<ScheduleInstallResult> {
  const label = input.label ?? defaultLaunchAgentLabel;
  const launchAgentsDir = input.launchAgentsDir ?? path.join(homedir(), "Library", "LaunchAgents");
  const logsDir = input.logsDir ?? path.join(homedir(), ".config", "singbox-iac", "logs");
  const plistPath = path.join(launchAgentsDir, `${label}.plist`);
  const stdoutPath = path.join(logsDir, `${label}.stdout.log`);
  const stderrPath = path.join(logsDir, `${label}.stderr.log`);

  if (input.force !== true && (await pathExists(plistPath))) {
    throw new Error(`LaunchAgent already exists: ${plistPath}`);
  }

  await mkdir(launchAgentsDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });

  if (input.load !== false) {
    await runLaunchctl(["bootout", launchctlDomainService(label)], true);
  }

  const workingDirectory = input.workingDirectory ?? process.cwd();
  const programArguments = resolveProgramArguments({
    cliEntrypoint: path.resolve(input.cliEntrypoint),
    configPath: path.resolve(input.configPath),
    workingDirectory,
  });

  const plist = renderLaunchAgentPlist({
    label,
    intervalMinutes: input.intervalMinutes,
    workingDirectory,
    stdoutPath,
    stderrPath,
    programArguments,
    ...(input.singBoxBinary || input.chromeBinary
      ? {
          environment: {
            ...(input.singBoxBinary ? { SING_BOX_BIN: path.resolve(input.singBoxBinary) } : {}),
            ...(input.chromeBinary ? { CHROME_BIN: path.resolve(input.chromeBinary) } : {}),
          },
        }
      : {}),
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

export async function removeLaunchdSchedule(input: ScheduleRemoveInput): Promise<string> {
  const label = input.label ?? defaultLaunchAgentLabel;
  const launchAgentsDir = input.launchAgentsDir ?? path.join(homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(launchAgentsDir, `${label}.plist`);

  if (input.unload !== false) {
    await runLaunchctl(["bootout", launchctlDomainService(label)], true);
  }

  await rm(plistPath, { force: true });
  return plistPath;
}

export function renderLaunchAgentPlist(input: {
  readonly label: string;
  readonly intervalMinutes: number;
  readonly workingDirectory: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly programArguments: readonly string[];
  readonly environment?: Readonly<Record<string, string>>;
}): string {
  const environmentEntries = {
    PATH: resolveLaunchdPath(),
    ...(input.environment ?? {}),
  };

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
  <integer>${input.intervalMinutes * 60}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(input.stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(input.stderrPath)}</string>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(environmentEntries)
  .map(
    ([key, value]) => `    <key>${escapeXml(key)}</key>\n    <string>${escapeXml(value)}</string>`,
  )
  .join("\n")}
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
    throw new Error("launchd scheduling requires process.getuid(), which is unavailable here.");
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

function resolveProgramArguments(input: {
  readonly cliEntrypoint: string;
  readonly configPath: string;
  readonly workingDirectory: string;
}): string[] {
  if (path.extname(input.cliEntrypoint) === ".ts") {
    const tsxBinary = path.resolve(input.workingDirectory, "node_modules", ".bin", "tsx");
    return [tsxBinary, input.cliEntrypoint, "update", "--config", input.configPath];
  }

  return [process.execPath, input.cliEntrypoint, "update", "--config", input.configPath];
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
