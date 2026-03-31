import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BuilderConfig } from "../../config/schema.js";
import type { BuildArtifact, BuildResult } from "../../domain/config.js";
import { compileConfig } from "../compiler/index.js";
import { fetchSubscription } from "../fetcher/index.js";
import { parseSubscription } from "../parser/index.js";
import { loadUserRules } from "../user-rules/index.js";

export interface BuildConfigInput {
  readonly config: BuilderConfig;
  readonly outputPath?: string;
  readonly subscriptionFile?: string;
  readonly subscriptionUrl?: string;
}

export interface BuiltConfigArtifact extends BuildResult {
  readonly artifact: BuildArtifact["config"];
  readonly nodeCount: number;
}

export async function buildConfigArtifact(input: BuildConfigInput): Promise<BuiltConfigArtifact> {
  const subscriptionContent = await resolveSubscriptionInput(input);
  const parsed = parseSubscription({ content: subscriptionContent });
  if (parsed.nodes.length === 0) {
    throw new Error("No valid proxy nodes were parsed from the subscription.");
  }

  const loadedUserRules = await loadUserRules(input.config.rules.userRulesFile);
  const artifact = compileConfig({
    nodes: parsed.nodes,
    config: input.config,
    userRules: loadedUserRules,
  });
  const outputPath = input.outputPath ?? input.config.output.stagingPath;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact.config, null, 2)}\n`, "utf8");

  return {
    outputPath,
    warnings: [...parsed.errors, ...loadedUserRules.warnings, ...artifact.warnings],
    artifact: artifact.config,
    nodeCount: parsed.nodes.length,
  };
}

async function resolveSubscriptionInput(input: BuildConfigInput): Promise<string> {
  if (input.subscriptionFile) {
    return readFile(input.subscriptionFile, "utf8");
  }

  const url = input.subscriptionUrl ?? input.config.subscription.url;
  if (!url) {
    throw new Error(
      "A subscription URL is required. Pass --subscription-url or provide a config file.",
    );
  }

  return fetchSubscription({ url });
}
