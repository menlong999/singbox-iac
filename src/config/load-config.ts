import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import YAML from "yaml";

import { type BuilderConfig, builderConfigSchema } from "./schema.js";

export async function loadConfig(filePath: string): Promise<BuilderConfig> {
  const raw = await readFile(filePath, "utf8");
  const parsed = YAML.parse(raw);
  return builderConfigSchema.parse(expandBuilderPaths(parsed));
}

function expandBuilderPaths(input: unknown): unknown {
  if (typeof input === "string") {
    return expandHome(input);
  }

  if (Array.isArray(input)) {
    return input.map(expandBuilderPaths);
  }

  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, expandBuilderPaths(value)]),
    );
  }

  return input;
}

function expandHome(value: string): string {
  if (!value.startsWith("~/")) {
    return value;
  }
  return path.join(homedir(), value.slice(2));
}
