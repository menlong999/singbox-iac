import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BuilderConfig } from "../../config/schema.js";

export interface SyncRuleSetsInput {
  readonly ruleSets: BuilderConfig["ruleSets"];
  readonly force?: boolean;
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

export async function syncLocalRuleSets(input: SyncRuleSetsInput): Promise<SyncRuleSetsResult> {
  const downloaded: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ tag: string; path: string; reason: string }> = [];

  for (const ruleSet of input.ruleSets) {
    if (input.force !== true && (await pathExists(ruleSet.path))) {
      skipped.push(ruleSet.tag);
      continue;
    }

    try {
      const response = await fetch(resolveRuleSetDownloadUrl(ruleSet.tag), {
        headers: {
          accept: "application/octet-stream,*/*",
          "user-agent": "singbox-iac/0.1.0",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const payload = Buffer.from(await response.arrayBuffer());
      await mkdir(path.dirname(ruleSet.path), { recursive: true });
      await writeFile(ruleSet.path, payload);
      downloaded.push(ruleSet.tag);
    } catch (error) {
      failed.push({
        tag: ruleSet.tag,
        path: ruleSet.path,
        reason: error instanceof Error ? error.message : String(error),
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

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
