import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

const fixturePath = path.resolve(process.cwd(), "tests/fixtures/subscriptions/trojan-sample.b64");
const fixtureContent = readFileSync(fixturePath, "utf8");

describe("setup command", () => {
  const tempDirs: string[] = [];
  const originalHome = process.env.HOME;

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    if (originalHome === undefined) {
      process.env.HOME = undefined;
    } else {
      process.env.HOME = originalHome;
    }
    vi.restoreAllMocks();
  });

  it("bootstraps the default user config, syncs rule sets, and builds a staging config", async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), "singbox-iac-home-"));
    tempDirs.push(homeDir);
    process.env.HOME = homeDir;

    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | RequestInfo) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : String(input);
        if (url === "https://example.com/subscription") {
          return new Response(fixtureContent, { status: 200 });
        }
        if (url.startsWith("https://raw.githubusercontent.com/SagerNet/")) {
          return new Response("stub-ruleset", { status: 200 });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      }),
    );

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "setup",
      "--subscription-url",
      "https://example.com/subscription",
      "--prompt",
      "GitHub 走香港，Gemini 走新加坡，每45分钟自动更新",
    ]);

    const configPath = path.join(homeDir, ".config", "singbox-iac", "builder.config.yaml");
    const rulesPath = path.join(homeDir, ".config", "singbox-iac", "rules", "custom.rules.yaml");
    const stagingPath = path.join(
      homeDir,
      ".config",
      "singbox-iac",
      "generated",
      "config.staging.json",
    );
    const geositeCnPath = path.join(homeDir, ".config", "sing-box", "rule-set", "geosite-cn.srs");

    const output = writeSpy.mock.calls.map((call) => String(call[0])).join("");

    expect(existsSync(configPath)).toBe(true);
    expect(existsSync(rulesPath)).toBe(true);
    expect(existsSync(stagingPath)).toBe(true);
    expect(existsSync(geositeCnPath)).toBe(true);
    expect(readFileSync(configPath, "utf8")).toContain("https://example.com/subscription");
    expect(readFileSync(configPath, "utf8")).toContain("intervalMinutes: 45");
    expect(readFileSync(rulesPath, "utf8")).toContain("github.com");
    expect(readFileSync(stagingPath, "utf8")).toContain('"type": "trojan"');
    expect(output).toContain("Doctor:");
    expect(writeSpy).toHaveBeenCalled();
  });
});
