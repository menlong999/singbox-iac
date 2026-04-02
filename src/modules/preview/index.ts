import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { BuilderConfig } from "../../config/schema.js";
import type { IntentIR } from "../../domain/intent.js";
import { buildConfigArtifact } from "../build/index.js";
import type { NaturalLanguagePlan } from "../natural-language/index.js";
import {
  applyPlanToBuilderConfig,
  renderGeneratedRules,
  renderUpdatedBuilderConfig,
} from "../natural-language/index.js";

export interface PreviewDiff {
  readonly label: string;
  readonly changed: boolean;
  readonly diff: string;
}

export interface GenerateAuthoringPreviewInput {
  readonly configPath: string;
  readonly config: BuilderConfig;
  readonly plan: NaturalLanguagePlan;
  readonly rulesPath: string;
  readonly currentIntent: IntentIR;
  readonly proposedIntent: IntentIR;
  readonly subscriptionFile?: string;
  readonly subscriptionUrl?: string;
  readonly buildStaging?: boolean;
}

export interface AuthoringPreviewReport {
  readonly intentDiff: PreviewDiff;
  readonly rulesDiff: PreviewDiff;
  readonly configDiff: PreviewDiff;
  readonly stagingDiff?: PreviewDiff;
}

export async function generateAuthoringPreview(
  input: GenerateAuthoringPreviewInput,
): Promise<AuthoringPreviewReport> {
  const [currentConfigRaw, currentRulesRaw] = await Promise.all([
    readFile(input.configPath, "utf8"),
    readFileIfExists(input.rulesPath),
  ]);
  const proposedRules = renderGeneratedRules(input.plan);
  const proposedConfig = renderUpdatedBuilderConfig({
    rawConfig: currentConfigRaw,
    rulesPath: input.rulesPath,
    ...(input.plan.scheduleIntervalMinutes
      ? { intervalMinutes: input.plan.scheduleIntervalMinutes }
      : {}),
    ...(input.plan.groupDefaults ? { groupDefaults: input.plan.groupDefaults } : {}),
    ...(input.plan.verificationOverrides
      ? { verificationOverrides: input.plan.verificationOverrides }
      : {}),
  });

  const effectiveConfig = applyPlanToBuilderConfig(input.config, {
    rulesPath: input.rulesPath,
    plan: input.plan,
  });

  const intentDiff = await createUnifiedDiff(
    "intent-ir",
    JSON.stringify(input.currentIntent, null, 2),
    JSON.stringify(input.proposedIntent, null, 2),
  );
  const rulesDiff = await createUnifiedDiff("rules", currentRulesRaw ?? "", proposedRules);
  const configDiff = await createUnifiedDiff("builder-config", currentConfigRaw, proposedConfig);

  if (input.buildStaging === false) {
    return {
      intentDiff,
      rulesDiff,
      configDiff,
    };
  }

  const runDir = await mkdtemp(path.join(tmpdir(), "singbox-iac-author-preview-"));
  try {
    const tempRulesPath = path.join(runDir, "custom.rules.yaml");
    const tempStagingPath = path.join(runDir, "config.staging.json");
    await writeFile(tempRulesPath, proposedRules, "utf8");

    await buildConfigArtifact({
      config: {
        ...effectiveConfig,
        output: {
          ...effectiveConfig.output,
          stagingPath: tempStagingPath,
        },
        rules: {
          ...effectiveConfig.rules,
          userRulesFile: tempRulesPath,
        },
      },
      ...(input.subscriptionFile ? { subscriptionFile: input.subscriptionFile } : {}),
      ...(input.subscriptionUrl ? { subscriptionUrl: input.subscriptionUrl } : {}),
    });

    const [currentStagingRaw, proposedStagingRaw] = await Promise.all([
      readFileIfExists(input.config.output.stagingPath),
      readFile(tempStagingPath, "utf8"),
    ]);

    return {
      intentDiff,
      rulesDiff,
      configDiff,
      stagingDiff: await createUnifiedDiff(
        "staging-config",
        currentStagingRaw ?? "",
        proposedStagingRaw,
      ),
    };
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}

async function readFileIfExists(filePath: string): Promise<string | undefined> {
  try {
    await access(filePath, constants.F_OK);
    return readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function createUnifiedDiff(
  label: string,
  currentContent: string,
  nextContent: string,
): Promise<PreviewDiff> {
  const currentNormalized = ensureTrailingNewline(currentContent);
  const nextNormalized = ensureTrailingNewline(nextContent);
  if (currentNormalized === nextNormalized) {
    return {
      label,
      changed: false,
      diff: `(no changes in ${label})`,
    };
  }

  const runDir = await mkdtemp(path.join(tmpdir(), "singbox-iac-diff-"));
  try {
    const beforePath = path.join(runDir, "before.txt");
    const afterPath = path.join(runDir, "after.txt");
    await Promise.all([
      writeFile(beforePath, currentNormalized, "utf8"),
      writeFile(afterPath, nextNormalized, "utf8"),
    ]);

    const diff = await runDiff(label, beforePath, afterPath);
    return {
      label,
      changed: true,
      diff,
    };
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}

async function runDiff(label: string, beforePath: string, afterPath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("/usr/bin/diff", [
      "-u",
      "-L",
      `current:${label}`,
      "-L",
      `proposed:${label}`,
      beforePath,
      afterPath,
    ]);

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
      if (code === 0 || code === 1) {
        resolve(stdout.trimEnd());
        return;
      }

      reject(new Error(stderr.trim() || `diff failed for ${label}`));
    });
  });
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
