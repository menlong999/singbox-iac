import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../config/load-config.js";
import type { BuilderConfig } from "../config/schema.js";

export interface SharedCommandOptions {
  readonly config?: string;
}

export function getDefaultConfigDir(): string {
  return path.join(homedir(), ".config", "singbox-iac");
}

export function getDefaultConfigPath(): string {
  return path.join(getDefaultConfigDir(), "builder.config.yaml");
}

export function getDefaultRulesPath(): string {
  return path.join(getDefaultConfigDir(), "rules", "custom.rules.yaml");
}

export async function resolveBuilderConfig(
  options: SharedCommandOptions,
): Promise<BuilderConfig | undefined> {
  if (options.config) {
    return loadConfig(options.config);
  }

  const configPath = await findDefaultConfigPath();
  if (!configPath) {
    return undefined;
  }

  return loadConfig(configPath);
}

export async function findDefaultConfigPath(): Promise<string | undefined> {
  for (const filePath of getDefaultConfigCandidates()) {
    if (await fileExists(filePath)) {
      return filePath;
    }
  }

  return undefined;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getDefaultConfigCandidates(): readonly string[] {
  return [
    path.resolve(process.cwd(), "builder.config.local.yaml"),
    path.resolve(process.cwd(), "builder.config.yaml"),
    getDefaultConfigPath(),
  ];
}

export function resolvePackageRoot(moduleUrl: string): string {
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), "../../..");
}

export function resolveCliEntrypoint(moduleUrl: string): string {
  const commandModulePath = fileURLToPath(moduleUrl);
  const extension = path.extname(commandModulePath);
  return path.resolve(path.dirname(commandModulePath), "..", `index${extension}`);
}
