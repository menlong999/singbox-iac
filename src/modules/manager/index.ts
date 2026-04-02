import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type { BuilderConfig } from "../../config/schema.js";
import { resolveSingBoxDependency } from "../runtime-dependencies/index.js";

export interface CheckConfigInput {
  readonly configPath: string;
  readonly singBoxBinary?: string;
}

export interface ApplyConfigInput {
  readonly stagingPath: string;
  readonly livePath: string;
  readonly backupPath?: string;
  readonly singBoxBinary?: string;
  readonly reload?: boolean;
  readonly runtime?: BuilderConfig["runtime"]["reload"];
}

export interface RunConfigInput {
  readonly configPath: string;
  readonly singBoxBinary?: string;
  readonly validateFirst?: boolean;
}

export interface CheckConfigResult {
  readonly binaryPath: string;
}

export async function checkConfig(input: CheckConfigInput): Promise<CheckConfigResult> {
  const binaryPath = await resolveSingBoxBinary(input.singBoxBinary);
  await runCommand(binaryPath, ["check", "-c", input.configPath]);
  return { binaryPath };
}

export async function applyConfig(input: ApplyConfigInput): Promise<void> {
  const { binaryPath } = await checkConfig({
    configPath: input.stagingPath,
    ...(input.singBoxBinary ? { singBoxBinary: input.singBoxBinary } : {}),
  });

  await mkdir(path.dirname(input.livePath), { recursive: true });
  if (input.backupPath && (await pathExists(input.livePath))) {
    await mkdir(path.dirname(input.backupPath), { recursive: true });
    await copyFile(input.livePath, input.backupPath);
  }
  await copyFile(input.stagingPath, input.livePath);

  if (input.reload && input.runtime) {
    await reloadSingBox({
      kind: input.runtime.kind,
      ...(input.runtime.processName ? { processName: input.runtime.processName } : {}),
      ...(input.runtime.signal ? { signal: input.runtime.signal } : {}),
      ...(input.runtime.command ? { command: input.runtime.command } : {}),
      binaryPath,
    });
  }
}

export async function runConfig(input: RunConfigInput): Promise<number> {
  const binaryPath = await resolveSingBoxBinary(input.singBoxBinary);
  if (input.validateFirst !== false) {
    await checkConfig({
      configPath: input.configPath,
      singBoxBinary: binaryPath,
    });
  }

  return new Promise<number>((resolve, reject) => {
    const child = spawn(binaryPath, ["run", "-c", input.configPath], {
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 0));
  });
}

export async function reloadRuntime(input: {
  readonly singBoxBinary?: string;
  readonly runtime: BuilderConfig["runtime"]["reload"];
}): Promise<void> {
  const binaryPath = await resolveSingBoxBinary(input.singBoxBinary);
  await reloadSingBox({
    kind: input.runtime.kind,
    ...(input.runtime.processName ? { processName: input.runtime.processName } : {}),
    ...(input.runtime.signal ? { signal: input.runtime.signal } : {}),
    ...(input.runtime.command ? { command: input.runtime.command } : {}),
    binaryPath,
  });
}

export async function shouldAutoReloadRuntime(
  runtime: BuilderConfig["runtime"]["reload"],
): Promise<boolean> {
  if (runtime.kind !== "signal" || !runtime.processName) {
    return false;
  }

  return isProcessRunning(runtime.processName);
}

export async function resolveSingBoxBinary(
  explicitPath?: string,
  persistedPath?: string,
): Promise<string> {
  const resolved = await resolveSingBoxDependency({
    explicitPath,
    persistedPath,
  });
  return resolved.path;
}

interface ReloadInput {
  readonly binaryPath: string;
  readonly kind: "signal" | "command";
  readonly processName?: string;
  readonly signal?: string;
  readonly command?: string;
}

async function reloadSingBox(input: ReloadInput): Promise<void> {
  if (input.kind === "command") {
    if (!input.command) {
      throw new Error("Reload command was requested but no command was configured.");
    }
    await runCommand("/bin/sh", ["-lc", input.command]);
    return;
  }

  if (!input.processName || !input.signal) {
    throw new Error("Signal-based reload requires processName and signal.");
  }

  await runCommand("/usr/bin/killall", [`-${input.signal}`, input.processName]);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(command: string, args: readonly string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
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
        resolve();
        return;
      }

      const details = [stdout.trim(), stderr.trim()].filter((value) => value.length > 0).join("\n");
      reject(new Error(details || `Command failed: ${command} ${args.join(" ")}`));
    });
  });
}

async function isProcessRunning(processName: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const child = spawn("/usr/bin/pgrep", ["-x", processName], {
      stdio: ["ignore", "ignore", "ignore"],
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code === 0));
  });
}
