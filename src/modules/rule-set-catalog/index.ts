import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export interface OfficialRuleSetCatalog {
  readonly refreshedAt: string;
  readonly geositeRef: string;
  readonly geoipRef: string;
  readonly geositeTags: readonly string[];
  readonly geoipTags: readonly string[];
}

export interface LoadedOfficialRuleSetCatalog extends OfficialRuleSetCatalog {
  readonly cachePath: string;
  readonly source: "remote" | "cache" | "stale-cache";
}

export interface LoadOfficialRuleSetCatalogInput {
  readonly cachePath?: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  readonly refresh?: boolean;
  readonly ttlMs?: number;
}

interface GithubGitRefResponse {
  readonly object?: {
    readonly sha?: string;
  };
}

interface GithubGitTreeResponse {
  readonly tree?: ReadonlyArray<{
    readonly path?: string;
  }>;
}

const defaultCatalogTtlMs = 24 * 60 * 60 * 1000;

export function defaultOfficialRuleSetCatalogCachePath(): string {
  return path.join(homedir(), ".config", "singbox-iac", "cache", "official-rule-set-catalog.json");
}

export async function loadOfficialRuleSetCatalog(
  input: LoadOfficialRuleSetCatalogInput = {},
): Promise<LoadedOfficialRuleSetCatalog> {
  const cachePath = input.cachePath ?? defaultOfficialRuleSetCatalogCachePath();
  const ttlMs = input.ttlMs ?? defaultCatalogTtlMs;
  const now = input.now ?? (() => new Date());
  const cached = await readCatalogCache(cachePath);

  if (input.refresh !== true && cached) {
    const ageMs = Math.max(0, now().getTime() - Date.parse(cached.refreshedAt));
    if (Number.isFinite(ageMs) && ageMs <= ttlMs) {
      return {
        ...cached,
        cachePath,
        source: "cache",
      };
    }
  }

  try {
    const refreshed = await fetchOfficialRuleSetCatalog({
      ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
      refreshedAt: now().toISOString(),
    });
    await writeCatalogCache(cachePath, refreshed);
    return {
      ...refreshed,
      cachePath,
      source: "remote",
    };
  } catch {
    if (!cached) {
      throw new Error(
        "Unable to refresh the official rule-set catalog and no cached catalog is available.",
      );
    }

    return {
      ...cached,
      cachePath,
      source: "stale-cache",
    };
  }
}

export async function fetchOfficialRuleSetCatalog(input?: {
  readonly fetchImpl?: typeof fetch;
  readonly refreshedAt?: string;
}): Promise<OfficialRuleSetCatalog> {
  const fetchImpl = input?.fetchImpl ?? fetch;
  const [geositeRef, geoipRef] = await Promise.all([
    fetchRuleSetBranchHead(fetchImpl, "SagerNet", "sing-geosite"),
    fetchRuleSetBranchHead(fetchImpl, "SagerNet", "sing-geoip"),
  ]);
  const [geositeTags, geoipTags] = await Promise.all([
    fetchRuleSetTags(fetchImpl, "SagerNet", "sing-geosite", geositeRef),
    fetchRuleSetTags(fetchImpl, "SagerNet", "sing-geoip", geoipRef),
  ]);

  return {
    refreshedAt: input?.refreshedAt ?? new Date().toISOString(),
    geositeRef,
    geoipRef,
    geositeTags,
    geoipTags,
  };
}

export function isOfficialRuleSetTag(catalog: OfficialRuleSetCatalog, tag: string): boolean {
  return catalog.geositeTags.includes(tag) || catalog.geoipTags.includes(tag);
}

async function fetchRuleSetBranchHead(
  fetchImpl: typeof fetch,
  owner: string,
  repo: string,
): Promise<string> {
  const response = await fetchGithubJson<GithubGitRefResponse>(
    fetchImpl,
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/rule-set`,
  );
  const sha = response.object?.sha;
  if (!sha) {
    throw new Error(`Missing rule-set branch head for ${owner}/${repo}.`);
  }
  return sha;
}

async function fetchRuleSetTags(
  fetchImpl: typeof fetch,
  owner: string,
  repo: string,
  treeSha: string,
): Promise<readonly string[]> {
  const response = await fetchGithubJson<GithubGitTreeResponse>(
    fetchImpl,
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
  );
  const tags = new Set<string>();
  for (const entry of response.tree ?? []) {
    const nextPath = entry.path;
    if (!nextPath || !nextPath.endsWith(".srs")) {
      continue;
    }
    tags.add(nextPath.slice(0, -4));
  }
  return [...tags].sort();
}

async function fetchGithubJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "singbox-iac/0.1.16",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${url}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function readCatalogCache(filePath: string): Promise<OfficialRuleSetCatalog | undefined> {
  if (!(await pathExists(filePath))) {
    return undefined;
  }

  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<OfficialRuleSetCatalog>;
  if (
    !parsed ||
    typeof parsed.refreshedAt !== "string" ||
    typeof parsed.geositeRef !== "string" ||
    typeof parsed.geoipRef !== "string" ||
    !Array.isArray(parsed.geositeTags) ||
    !Array.isArray(parsed.geoipTags)
  ) {
    return undefined;
  }

  return {
    refreshedAt: parsed.refreshedAt,
    geositeRef: parsed.geositeRef,
    geoipRef: parsed.geoipRef,
    geositeTags: parsed.geositeTags.filter((value): value is string => typeof value === "string"),
    geoipTags: parsed.geoipTags.filter((value): value is string => typeof value === "string"),
  };
}

async function writeCatalogCache(filePath: string, catalog: OfficialRuleSetCatalog): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(catalog, null, 2).concat("\n"), "utf8");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
