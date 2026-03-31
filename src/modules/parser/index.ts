import type { NormalizedNode } from "../../domain/node.js";

export interface ParseSubscriptionInput {
  readonly content: string;
}

export interface ParseSubscriptionResult {
  readonly nodes: NormalizedNode[];
  readonly errors: string[];
}

const infoTagPattern = /剩余流量|下次重置|套餐到期|流量|到期|重置/i;

const regionMatchers: ReadonlyArray<readonly [string, RegExp]> = [
  ["HK", /🇭🇰|香港|\bhk\b/i],
  ["SG", /🇸🇬|新加坡|\bsg\b/i],
  ["US", /🇺🇸|美国|\bus\b/i],
  ["JP", /🇯🇵|日本|\bjp\b/i],
];

export function decodeSubscriptionContent(content: string): string[] {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return [];
  }

  if (trimmed.includes("://")) {
    return splitLines(trimmed);
  }

  const sanitized = trimmed.replace(/\s+/gu, "").replace(/-/gu, "+").replace(/_/gu, "/");
  const paddingLength = (4 - (sanitized.length % 4)) % 4;
  const decoded = Buffer.from(`${sanitized}${"=".repeat(paddingLength)}`, "base64")
    .toString("utf8")
    .trim();
  if (!decoded.includes("://")) {
    throw new Error(
      "Subscription content is neither line-based URI text nor valid Base64 URI text.",
    );
  }

  return splitLines(decoded);
}

export function parseSubscription(input: ParseSubscriptionInput): ParseSubscriptionResult {
  const lines = decodeSubscriptionContent(input.content);
  const seenTags = new Map<string, number>();
  const nodes: NormalizedNode[] = [];
  const errors: string[] = [];

  for (const [index, line] of lines.entries()) {
    try {
      const node = parseTrojanLine(line, index + 1, seenTags);
      if (node === null) {
        errors.push(`Line ${index + 1}: skipped non-node subscription entry.`);
        continue;
      }
      nodes.push(node);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Line ${index + 1}: ${message}`);
    }
  }

  return { nodes, errors };
}

function splitLines(content: string): string[] {
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseTrojanLine(
  line: string,
  lineNumber: number,
  seenTags: Map<string, number>,
): NormalizedNode | null {
  const url = new URL(line);
  if (url.protocol !== "trojan:") {
    throw new Error(`Unsupported protocol "${url.protocol.replace(":", "")}"`);
  }

  const password = decodeURIComponent(url.username || url.password);
  const server = url.hostname;
  const serverPort = Number.parseInt(url.port, 10);
  const rawTag = decodeURIComponent(url.hash.replace(/^#/u, "")).trim();
  const tag = rawTag.length > 0 ? rawTag : `trojan-${lineNumber}`;

  if (password.length === 0) {
    throw new Error("Missing Trojan password.");
  }

  if (server.length === 0 || Number.isNaN(serverPort)) {
    throw new Error("Missing Trojan server or port.");
  }

  if (infoTagPattern.test(tag)) {
    return null;
  }

  const insecure = parseBoolean(url.searchParams.get("allowInsecure"));
  const sni = firstNonEmpty(
    url.searchParams.get("sni"),
    url.searchParams.get("peer"),
    url.hostname,
  );
  const regionHint = detectRegion(tag);

  return {
    protocol: "trojan",
    tag: makeUniqueTag(tag, seenTags),
    server,
    serverPort,
    password,
    ...(sni ? { sni } : {}),
    ...(insecure !== undefined ? { insecure } : {}),
    ...(regionHint ? { regionHint } : {}),
  };
}

function makeUniqueTag(tag: string, seenTags: Map<string, number>): string {
  const current = seenTags.get(tag) ?? 0;
  seenTags.set(tag, current + 1);
  return current === 0 ? tag : `${tag} (${current + 1})`;
}

function detectRegion(tag: string): string | undefined {
  for (const [region, pattern] of regionMatchers) {
    if (pattern.test(tag)) {
      return region;
    }
  }
  return undefined;
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }
  return /^(1|true|yes)$/iu.test(value);
}

function firstNonEmpty(...values: Array<string | null>): string | undefined {
  for (const value of values) {
    if (value !== null && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}
