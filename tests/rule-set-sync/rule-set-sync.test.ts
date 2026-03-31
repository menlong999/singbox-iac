import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { syncLocalRuleSets } from "../../src/modules/rule-set-sync/index.js";

describe("rule-set sync", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("uses bundled common rulesets when network fetch is unavailable", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-ruleset-sync-"));
    tempDirs.push(dir);
    const targetPath = path.join(dir, "geosite-cn.srs");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const progress: string[] = [];
    const result = await syncLocalRuleSets({
      ruleSets: [
        {
          tag: "geosite-cn",
          path: targetPath,
          format: "binary",
        },
      ],
      onProgress: (event) => {
        progress.push(`${event.phase}:${event.tag}`);
      },
    });

    expect(result.downloaded).toEqual(["geosite-cn"]);
    expect(result.failed).toEqual([]);
    expect(progress).toContain("bundled:geosite-cn");
    expect(existsSync(targetPath)).toBe(true);
    expect(readFileSync(targetPath).byteLength).toBeGreaterThan(0);
  });
});
