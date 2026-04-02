import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import path from "node:path";

import YAML from "yaml";

export type RuntimeDependencySource =
  | "explicit"
  | "persisted"
  | "env"
  | "repo-tool"
  | "path"
  | "app-bundle";

export interface ResolvedRuntimeDependency {
  readonly path: string;
  readonly source: RuntimeDependencySource;
}

export interface PersistedRuntimeDependencies {
  readonly singBoxBinary?: string;
  readonly chromeBinary?: string;
}

export async function resolveSingBoxDependency(
  input: {
    readonly explicitPath?: string | undefined;
    readonly persistedPath?: string | undefined;
  } = {},
): Promise<ResolvedRuntimeDependency> {
  const candidates: ResolvedRuntimeDependency[] = [];

  if (input.explicitPath) {
    candidates.push({ path: input.explicitPath, source: "explicit" });
  }
  if (input.persistedPath) {
    candidates.push({ path: input.persistedPath, source: "persisted" });
  }
  if (process.env.SING_BOX_BIN) {
    candidates.push({ path: process.env.SING_BOX_BIN, source: "env" });
  }
  candidates.push({
    path: path.resolve(process.cwd(), ".tools", "sing-box-1.13.4-darwin-arm64", "sing-box"),
    source: "repo-tool",
  });
  for (const candidate of resolvePathCandidates("sing-box")) {
    candidates.push({ path: candidate, source: "path" });
  }

  for (const candidate of candidates) {
    if (await isExecutable(candidate.path)) {
      return candidate;
    }
  }

  const installHint =
    platform() === "darwin"
      ? " Install it with `brew install sing-box`, set runtime.dependencies.singBoxBinary, or set SING_BOX_BIN."
      : " Set runtime.dependencies.singBoxBinary or SING_BOX_BIN after installing sing-box.";

  throw new Error(`Unable to find a usable sing-box binary.${installHint}`);
}

export async function resolveChromeDependency(
  input: {
    readonly explicitPath?: string | undefined;
    readonly persistedPath?: string | undefined;
  } = {},
): Promise<ResolvedRuntimeDependency> {
  const candidates: ResolvedRuntimeDependency[] = [];

  if (input.explicitPath) {
    candidates.push({ path: input.explicitPath, source: "explicit" });
  }
  if (input.persistedPath) {
    candidates.push({ path: input.persistedPath, source: "persisted" });
  }
  if (process.env.CHROME_BIN) {
    candidates.push({ path: process.env.CHROME_BIN, source: "env" });
  }
  candidates.push({
    path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    source: "app-bundle",
  });
  candidates.push({
    path: "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    source: "app-bundle",
  });

  for (const candidate of candidates) {
    if (await isExecutable(candidate.path)) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to find a usable Chrome binary. Install Google Chrome, set runtime.dependencies.chromeBinary, or set CHROME_BIN.",
  );
}

export async function persistRuntimeDependencies(input: {
  readonly configPath: string;
  readonly singBox?: ResolvedRuntimeDependency;
  readonly chrome?: ResolvedRuntimeDependency;
}): Promise<boolean> {
  if (!input.singBox && !input.chrome) {
    return false;
  }

  const raw = await readFile(input.configPath, "utf8");
  const parsed = YAML.parse(raw) as Record<string, unknown>;
  const runtime = asRecord(parsed.runtime);
  const dependencies = asRecord(runtime.dependencies);

  let changed = false;

  if (input.singBox) {
    changed = updateValue(dependencies, "singBoxBinary", input.singBox.path) || changed;
    changed = updateValue(dependencies, "singBoxSource", input.singBox.source) || changed;
  }

  if (input.chrome) {
    changed = updateValue(dependencies, "chromeBinary", input.chrome.path) || changed;
    changed = updateValue(dependencies, "chromeSource", input.chrome.source) || changed;
  }

  changed = updateValue(dependencies, "resolvedAt", new Date().toISOString()) || changed;

  if (!changed) {
    return false;
  }

  runtime.dependencies = dependencies;
  parsed.runtime = runtime;
  await writeFile(input.configPath, YAML.stringify(parsed), "utf8");
  return true;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function updateValue(target: Record<string, unknown>, key: string, value: string): boolean {
  if (target[key] === value) {
    return false;
  }
  target[key] = value;
  return true;
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolvePathCandidates(commandName: string): string[] {
  return (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter((entry) => entry.length > 0)
    .map((entry) => path.join(entry, commandName))
    .filter((candidate, index, items) => items.indexOf(candidate) === index);
}
