import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../../src/cli/index.js";

const fixturePath = path.resolve(process.cwd(), "tests/fixtures/subscriptions/trojan-sample.b64");

describe("build command", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("builds a config from a local subscription file", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-"));
    tempDirs.push(dir);

    const outputPath = path.join(dir, "config.json");
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync([
      "node",
      "singbox-iac",
      "build",
      "--subscription-file",
      fixturePath,
      "--output",
      outputPath,
    ]);

    const generated = JSON.parse(readFileSync(outputPath, "utf8")) as {
      inbounds: Array<{ tag: string; listen_port: number }>;
      outbounds: Array<{ tag: string; type: string }>;
      route: { final: string };
    };

    expect(generated.route.final).toBe("Global");
    expect(generated.inbounds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tag: "in-mixed", listen_port: 39097 }),
        expect.objectContaining({ tag: "in-proxifier", listen_port: 39091 }),
      ]),
    );
    expect(generated.outbounds.some((outbound) => outbound.tag === "Global")).toBe(true);
    expect(generated.outbounds.some((outbound) => outbound.tag === "🇭🇰 香港 01")).toBe(true);
    expect(writeSpy).toHaveBeenCalled();
  });
});
