import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("package distribution metadata", () => {
  it("keeps the CLI installable from a packed tarball", () => {
    const packageJson = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
    ) as {
      bin: Record<string, string>;
      files?: string[];
      license?: string;
      name: string;
      scripts?: Record<string, string>;
      exports?: Record<string, unknown>;
      types?: string;
    };

    expect(packageJson.name).toBe("@singbox-iac/cli");
    expect(packageJson.bin["singbox-iac"]).toBe("dist/cli/index.js");
    expect(packageJson.files).toEqual(
      expect.arrayContaining(["dist", "README.md", "docs", "examples"]),
    );
    expect(packageJson.scripts?.["clean:dist"]).toBe(
      "node -e \"require('node:fs').rmSync('dist', { recursive: true, force: true })\"",
    );
    expect(packageJson.scripts?.build).toBe("npm run clean:dist && tsc -p tsconfig.json");
    expect(packageJson.scripts?.prepare).toBe("npm run build");
    expect(packageJson.scripts?.prepack).toBe("npm run build");
    expect(packageJson.scripts?.["release:check"]).toBe("node ./scripts/release-check.mjs");
    expect(packageJson.scripts?.["release:dry-run"]).toBe("node ./scripts/release-dry-run.mjs");
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.types).toBe("./dist/index.d.ts");
    expect(packageJson.exports).toHaveProperty(".");
    expect(existsSync(path.resolve(process.cwd(), "scripts/release-check.mjs"))).toBe(true);
    expect(existsSync(path.resolve(process.cwd(), "scripts/release-dry-run.mjs"))).toBe(true);
    expect(existsSync(path.resolve(process.cwd(), "LICENSE"))).toBe(true);
    expect(existsSync(path.resolve(process.cwd(), "docs/releasing.md"))).toBe(true);
  });

  it("preserves a node shebang on the source CLI entrypoint", () => {
    const entrypoint = readFileSync(path.resolve(process.cwd(), "src/cli/index.ts"), "utf8");

    expect(entrypoint.startsWith("#!/usr/bin/env node")).toBe(true);
  });
});
