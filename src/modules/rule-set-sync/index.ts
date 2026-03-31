import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BuilderConfig } from "../../config/schema.js";

export interface SyncRuleSetsInput {
  readonly ruleSets: BuilderConfig["ruleSets"];
  readonly force?: boolean;
  readonly timeoutMs?: number;
  readonly onProgress?: (event: RuleSetSyncProgressEvent) => void;
}

export interface SyncRuleSetsResult {
  readonly downloaded: readonly string[];
  readonly skipped: readonly string[];
  readonly failed: ReadonlyArray<{
    tag: string;
    path: string;
    reason: string;
  }>;
}

export interface RuleSetSyncProgressEvent {
  readonly tag: string;
  readonly path: string;
  readonly index: number;
  readonly total: number;
  readonly phase: "start" | "downloaded" | "bundled" | "skipped" | "failed";
  readonly reason?: string;
}

export async function syncLocalRuleSets(input: SyncRuleSetsInput): Promise<SyncRuleSetsResult> {
  const downloaded: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ tag: string; path: string; reason: string }> = [];
  const total = input.ruleSets.length;

  for (const [index, ruleSet] of input.ruleSets.entries()) {
    const progressBase = {
      tag: ruleSet.tag,
      path: ruleSet.path,
      index: index + 1,
      total,
    } as const;

    if (input.force !== true && (await pathExists(ruleSet.path))) {
      skipped.push(ruleSet.tag);
      input.onProgress?.({
        ...progressBase,
        phase: "skipped",
      });
      continue;
    }

    try {
      const bundledPayload = await readBundledRuleSet(ruleSet.tag);
      if (bundledPayload) {
        await mkdir(path.dirname(ruleSet.path), { recursive: true });
        await writeFile(ruleSet.path, bundledPayload);
        downloaded.push(ruleSet.tag);
        input.onProgress?.({
          ...progressBase,
          phase: "bundled",
        });
        continue;
      }

      input.onProgress?.({
        ...progressBase,
        phase: "start",
      });
      const payload = await downloadRuleSetWithRetry(ruleSet.tag, input.timeoutMs);
      await mkdir(path.dirname(ruleSet.path), { recursive: true });
      await writeFile(ruleSet.path, payload);
      downloaded.push(ruleSet.tag);
      input.onProgress?.({
        ...progressBase,
        phase: "downloaded",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failed.push({
        tag: ruleSet.tag,
        path: ruleSet.path,
        reason,
      });
      input.onProgress?.({
        ...progressBase,
        phase: "failed",
        reason,
      });
    }
  }

  return {
    downloaded,
    skipped,
    failed,
  };
}

export function resolveRuleSetDownloadUrl(tag: string): string {
  const repo = tag.startsWith("geoip-") ? "sing-geoip" : "sing-geosite";
  return `https://raw.githubusercontent.com/SagerNet/${repo}/rule-set/${tag}.srs`;
}

async function downloadRuleSetWithRetry(tag: string, timeoutMs = 15000): Promise<Buffer> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(resolveRuleSetDownloadUrl(tag), {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: "application/octet-stream,*/*",
          "user-agent": "singbox-iac/0.1.0",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function readBundledRuleSet(tag: string): Promise<Buffer | undefined> {
  const bundledPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../assets/rule-set",
    `${tag}.srs`,
  );

  if (!(await pathExists(bundledPath))) {
    return undefined;
  }

  return readFile(bundledPath);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
