import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { createProgram, isDirectCliInvocation } from "../../src/cli/index.js";

describe("cli entrypoint detection", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats a symlinked npm bin path as a direct invocation", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-cli-entry-"));
    tempDirs.push(dir);

    const entryPath = path.join(dir, "dist", "cli", "index.js");
    const binPath = path.join(dir, "node_modules", ".bin", "singbox-iac");

    mkdirSync(path.dirname(entryPath), { recursive: true });
    mkdirSync(path.dirname(binPath), { recursive: true });
    writeFileSync(entryPath, "console.log('noop');\n", { encoding: "utf8", flag: "w" });
    symlinkSync(entryPath, binPath);

    expect(isDirectCliInvocation(pathToFileURL(entryPath).href, binPath)).toBe(true);
  });

  it("returns false for an unrelated argv path", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-cli-entry-"));
    tempDirs.push(dir);

    const entryPath = path.join(dir, "dist", "cli", "index.js");
    const otherPath = path.join(dir, "other.js");

    mkdirSync(path.dirname(entryPath), { recursive: true });
    writeFileSync(entryPath, "console.log('noop');\n");
    writeFileSync(otherPath, "console.log('noop');\n");

    expect(isDirectCliInvocation(pathToFileURL(entryPath).href, otherPath)).toBe(false);
  });
});

describe("cli help", () => {
  it("surfaces the streamlined everyday commands and hides advanced commands from the default help", () => {
    const help = createProgram().helpInformation();

    expect(help).toContain("go");
    expect(help).toContain("use");
    expect(help).toContain("update");
    expect(help).not.toContain("quickstart");
    expect(help).not.toContain("setup");
    expect(help).not.toContain("author");
    expect(help).not.toContain("build [options]");
  });
});
