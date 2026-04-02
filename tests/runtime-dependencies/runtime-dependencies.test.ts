import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  persistRuntimeDependencies,
  resolveChromeDependency,
  resolveSingBoxDependency,
} from "../../src/modules/runtime-dependencies/index.js";

describe("runtime dependencies", () => {
  const tempDirs: string[] = [];
  const originalPath = process.env.PATH;
  const originalSingBoxBin = process.env.SING_BOX_BIN;
  const originalChromeBin = process.env.CHROME_BIN;
  const originalCwd = process.cwd();

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
    process.env.PATH = originalPath;
    process.env.SING_BOX_BIN = originalSingBoxBin;
    process.env.CHROME_BIN = originalChromeBin;
    process.chdir(originalCwd);
  });

  it("prefers explicit and persisted sing-box paths before ambient discovery", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-runtime-deps-"));
    tempDirs.push(dir);

    const explicitPath = path.join(dir, "explicit-sing-box");
    const persistedPath = path.join(dir, "persisted-sing-box");
    const envPath = path.join(dir, "env-sing-box");
    const pathPath = path.join(dir, "path-sing-box");

    writeExecutable(explicitPath);
    writeExecutable(persistedPath);
    writeExecutable(envPath);
    writeExecutable(pathPath);

    process.env.SING_BOX_BIN = envPath;
    process.env.PATH = `${dir}${path.delimiter}${originalPath ?? ""}`;

    const explicit = await resolveSingBoxDependency({
      explicitPath,
      persistedPath,
    });
    expect(explicit.path).toBe(explicitPath);
    expect(explicit.source).toBe("explicit");

    const persisted = await resolveSingBoxDependency({
      persistedPath,
    });
    expect(persisted.path).toBe(persistedPath);
    expect(persisted.source).toBe("persisted");
  });

  it("falls back from an invalid persisted sing-box path to PATH discovery", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-runtime-deps-"));
    tempDirs.push(dir);

    const discoveredPath = path.join(dir, "sing-box");
    writeExecutable(discoveredPath);

    process.env.SING_BOX_BIN = undefined;
    process.env.PATH = `${dir}${path.delimiter}${originalPath ?? ""}`;
    process.chdir(dir);

    const resolved = await resolveSingBoxDependency({
      persistedPath: path.join(dir, "missing-sing-box"),
    });
    expect(resolved.path).toBe(discoveredPath);
    expect(resolved.source).toBe("path");
  });

  it("persists resolved sing-box and chrome paths into builder config", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-runtime-deps-"));
    tempDirs.push(dir);

    const configPath = path.join(dir, "builder.config.yaml");
    writeFileSync(
      configPath,
      `version: 1
subscription:
  url: "https://example.com/subscription"
  format: "base64-lines"
  protocols:
    - trojan
output:
  stagingPath: "${path.join(dir, "staging.json")}"
  livePath: "${path.join(dir, "live.json")}"
  backupPath: "${path.join(dir, "backup.json")}"
runtime:
  checkCommand: "sing-box check -c {{stagingPath}}"
  reload:
    kind: "signal"
    processName: "sing-box"
    signal: "HUP"
listeners:
  mixed:
    enabled: true
    listen: "127.0.0.1"
    port: 39097
  proxifier:
    enabled: true
    listen: "127.0.0.1"
    port: 39091
ruleSets: []
groups:
  processProxy:
    type: "selector"
    includes: ["US"]
  aiOut:
    type: "selector"
    includes: ["HK", "US"]
    defaultTarget: "HK"
  devCommonOut:
    type: "selector"
    includes: ["HK", "US"]
    defaultTarget: "HK"
  stitchOut:
    type: "selector"
    includes: ["US"]
    defaultTarget: "US"
  global:
    type: "urltest"
    includes: ["HK", "US"]
rules:
  userRulesFile: "${path.join(dir, "custom.rules.yaml")}"
verification:
  scenarios:
    - id: "chatgpt-hk"
      name: "ChatGPT uses the HK default AI path"
      url: "https://chatgpt.com/favicon.ico"
      inbound: "in-mixed"
      expectedOutbound: "AI-Out"
schedule:
  enabled: true
  intervalMinutes: 30
`,
    );

    await persistRuntimeDependencies({
      configPath,
      singBox: {
        path: "/opt/homebrew/bin/sing-box",
        source: "path",
      },
      chrome: {
        path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        source: "app-bundle",
      },
    });

    const rendered = readFileSync(configPath, "utf8");
    expect(rendered).toContain("singBoxBinary: /opt/homebrew/bin/sing-box");
    expect(rendered).toContain("singBoxSource: path");
    expect(rendered).toContain(
      "chromeBinary: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    );
    expect(rendered).toContain("chromeSource: app-bundle");
    expect(rendered).toContain("resolvedAt:");
  });

  it("prefers explicit and persisted Chrome paths before app bundle discovery", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-runtime-deps-"));
    tempDirs.push(dir);

    const explicitPath = path.join(dir, "explicit-chrome");
    const persistedPath = path.join(dir, "persisted-chrome");
    writeExecutable(explicitPath);
    writeExecutable(persistedPath);

    const explicit = await resolveChromeDependency({
      explicitPath,
      persistedPath,
    });
    expect(explicit.path).toBe(explicitPath);
    expect(explicit.source).toBe("explicit");

    const persisted = await resolveChromeDependency({
      persistedPath,
    });
    expect(persisted.path).toBe(persistedPath);
    expect(persisted.source).toBe("persisted");
  });
});

function writeExecutable(filePath: string): void {
  writeFileSync(filePath, "#!/bin/sh\nexit 0\n");
  chmodSync(filePath, 0o755);
}
