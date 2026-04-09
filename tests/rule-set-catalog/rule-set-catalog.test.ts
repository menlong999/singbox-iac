import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadOfficialRuleSetCatalog } from "../../src/modules/rule-set-catalog/index.js";

describe("official rule-set catalog", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refreshes from official upstream and reuses a fresh cache", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-ruleset-catalog-"));
    tempDirs.push(dir);
    const cachePath = path.join(dir, "catalog.json");
    const fetchImpl = vi.fn(async (input: string | URL | RequestInfo) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
      if (url.endsWith("/SagerNet/sing-geosite/git/ref/heads/rule-set")) {
        return jsonResponse({ object: { sha: "geosite-ref" } });
      }
      if (url.endsWith("/SagerNet/sing-geoip/git/ref/heads/rule-set")) {
        return jsonResponse({ object: { sha: "geoip-ref" } });
      }
      if (url.includes("/SagerNet/sing-geosite/git/trees/geosite-ref")) {
        return jsonResponse({
          tree: [{ path: "geosite-openai.srs" }, { path: "geosite-netflix.srs" }],
        });
      }
      if (url.includes("/SagerNet/sing-geoip/git/trees/geoip-ref")) {
        return jsonResponse({
          tree: [{ path: "geoip-cn.srs" }, { path: "geoip-us.srs" }],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const refreshed = await loadOfficialRuleSetCatalog({
      cachePath,
      fetchImpl,
      refresh: true,
      now: () => new Date("2026-04-09T00:00:00.000Z"),
    });

    expect(refreshed.source).toBe("remote");
    expect(refreshed.geositeTags).toEqual(["geosite-netflix", "geosite-openai"]);
    expect(refreshed.geoipTags).toEqual(["geoip-cn", "geoip-us"]);

    const cached = await loadOfficialRuleSetCatalog({
      cachePath,
      fetchImpl: vi.fn(async () => {
        throw new Error("should not refetch while cache is fresh");
      }),
      now: () => new Date("2026-04-09T01:00:00.000Z"),
    });

    expect(cached.source).toBe("cache");
    expect(cached.geositeRef).toBe("geosite-ref");
  });

  it("falls back to a stale cache when refresh fails", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-ruleset-catalog-stale-"));
    tempDirs.push(dir);
    const cachePath = path.join(dir, "catalog.json");

    await loadOfficialRuleSetCatalog({
      cachePath,
      fetchImpl: vi.fn(async (input: string | URL | RequestInfo) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : String(input);
        if (url.endsWith("/SagerNet/sing-geosite/git/ref/heads/rule-set")) {
          return jsonResponse({ object: { sha: "geosite-ref" } });
        }
        if (url.endsWith("/SagerNet/sing-geoip/git/ref/heads/rule-set")) {
          return jsonResponse({ object: { sha: "geoip-ref" } });
        }
        if (url.includes("/SagerNet/sing-geosite/git/trees/geosite-ref")) {
          return jsonResponse({ tree: [{ path: "geosite-openai.srs" }] });
        }
        if (url.includes("/SagerNet/sing-geoip/git/trees/geoip-ref")) {
          return jsonResponse({ tree: [{ path: "geoip-cn.srs" }] });
        }
        throw new Error(`Unexpected URL: ${url}`);
      }),
      refresh: true,
      now: () => new Date("2026-04-09T00:00:00.000Z"),
    });

    const stale = await loadOfficialRuleSetCatalog({
      cachePath,
      fetchImpl: vi.fn(async () => {
        throw new Error("upstream unavailable");
      }),
      refresh: true,
      now: () => new Date("2026-04-10T00:00:00.000Z"),
    });

    expect(stale.source).toBe("stale-cache");
    expect(stale.geositeTags).toEqual(["geosite-openai"]);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
