import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseSubscription } from "../../src/modules/parser/index.js";

const fixturePath = path.resolve(process.cwd(), "tests/fixtures/subscriptions/trojan-sample.b64");

describe("parseSubscription", () => {
  it("parses Base64 Trojan subscriptions, skips info lines, and deduplicates tags", () => {
    const content = readFileSync(fixturePath, "utf8");
    const result = parseSubscription({ content });

    expect(result.nodes).toHaveLength(4);
    expect(result.errors).toContain("Line 1: skipped non-node subscription entry.");

    expect(result.nodes[0]).toMatchObject({
      protocol: "trojan",
      tag: "🇭🇰 香港 01",
      server: "hk.example.com",
      serverPort: 443,
      sni: "hk.example.com",
      insecure: true,
      regionHint: "HK",
    });

    expect(result.nodes[1]).toMatchObject({
      tag: "🇺🇸 美国 01",
      regionHint: "US",
    });

    expect(result.nodes[3]).toMatchObject({
      tag: "🇺🇸 美国 01 (2)",
      regionHint: "US",
    });
  });

  it("accepts Base64 content without explicit padding", () => {
    const content = readFileSync(fixturePath, "utf8").trim().replace(/=+$/u, "");
    const result = parseSubscription({ content });

    expect(result.nodes).toHaveLength(4);
  });
});
