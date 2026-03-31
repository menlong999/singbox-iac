import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadUserRules } from "../../src/modules/user-rules/index.js";

describe("loadUserRules", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads a minimal DSL file and normalizes scalar matchers", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-user-rules-"));
    tempDirs.push(dir);

    const rulesPath = path.join(dir, "custom.rules.yaml");
    writeFileSync(
      rulesPath,
      `version: 1
beforeBuiltins:
  - name: "OpenRouter uses AI path"
    domainSuffix: "openrouter.ai"
    route: "AI-Out"
afterBuiltins:
  - name: "Reject test"
    inbound: "in-mixed"
    network: "udp"
    port: 443
    action: "reject"
`,
    );

    const loaded = await loadUserRules(rulesPath);
    expect(loaded.warnings).toEqual([]);
    expect(loaded.beforeBuiltins).toEqual([
      {
        name: "OpenRouter uses AI path",
        domainSuffix: ["openrouter.ai"],
        route: "AI-Out",
      },
    ]);
    expect(loaded.afterBuiltins).toEqual([
      {
        name: "Reject test",
        inbound: ["in-mixed"],
        network: "udp",
        port: 443,
        action: "reject",
      },
    ]);
  });

  it("returns a warning when the configured rules file is missing", async () => {
    const loaded = await loadUserRules(path.join(tmpdir(), "missing-custom.rules.yaml"));
    expect(loaded.beforeBuiltins).toEqual([]);
    expect(loaded.afterBuiltins).toEqual([]);
    expect(loaded.warnings[0]).toContain("continuing without custom rules");
  });
});
