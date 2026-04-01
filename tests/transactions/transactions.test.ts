import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { BuilderConfig } from "../../src/config/schema.js";
import {
  applyWithTransaction,
  listTransactionHistory,
  resolveTransactionHistoryPath,
  rollbackToPrevious,
} from "../../src/modules/transactions/index.js";

describe("transactions", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records applied transactions and keeps snapshots for rollback", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-transactions-"));
    tempDirs.push(dir);

    const config = makeConfig(dir);
    mkdirSync(path.dirname(config.output.livePath), { recursive: true });
    mkdirSync(path.dirname(config.output.stagingPath), { recursive: true });
    writeFileSync(config.output.livePath, '{"old":"config"}\n');
    writeFileSync(config.output.stagingPath, '{"new":"config"}\n');

    const applied = await applyWithTransaction({
      config,
      generatedPath: config.output.stagingPath,
      livePath: config.output.livePath,
      backupPath: config.output.backupPath,
      verificationSummary: { routeScenariosPassed: 3 },
      apply: async () => {
        writeFileSync(config.output.livePath, '{"new":"config"}\n');
      },
    });

    expect(applied.status).toBe("applied");
    expect(readFileSync(config.output.backupPath, "utf8")).toContain('"old":"config"');

    const history = await listTransactionHistory(config);
    expect(history[0]?.txId).toBe(applied.txId);
    expect(history[0]?.snapshotPath).toBeTruthy();
    expect(resolveTransactionHistoryPath(config)).toContain("transactions.json");
  });

  it("rolls back to the previous snapshot", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "singbox-iac-rollback-"));
    tempDirs.push(dir);

    const config = makeConfig(dir);
    mkdirSync(path.dirname(config.output.livePath), { recursive: true });
    mkdirSync(path.dirname(config.output.stagingPath), { recursive: true });
    writeFileSync(config.output.livePath, '{"v":1}\n');
    writeFileSync(config.output.stagingPath, '{"v":2}\n');

    await applyWithTransaction({
      config,
      generatedPath: config.output.stagingPath,
      livePath: config.output.livePath,
      backupPath: config.output.backupPath,
      verificationSummary: {},
      apply: async () => {
        writeFileSync(config.output.livePath, '{"v":2}\n');
      },
    });

    writeFileSync(config.output.livePath, '{"broken":true}\n');

    const rolledBack = await rollbackToPrevious({
      config,
    });

    expect(rolledBack.status).toBe("rolled-back");
    expect(readFileSync(config.output.livePath, "utf8")).toContain('"v":1');
  });
});

function makeConfig(dir: string): BuilderConfig {
  return {
    version: 1,
    subscription: {
      url: "https://example.com/subscription",
      format: "base64-lines",
      protocols: ["trojan"],
    },
    output: {
      stagingPath: path.join(dir, "generated", "config.staging.json"),
      livePath: path.join(dir, "live", "config.json"),
      backupPath: path.join(dir, "generated", "config.last-known-good.json"),
    },
    runtime: {
      checkCommand: "sing-box check -c {{stagingPath}}",
      reload: {
        kind: "signal",
        processName: "sing-box",
        signal: "HUP",
      },
    },
    listeners: {
      mixed: { enabled: true, listen: "127.0.0.1", port: 39097 },
      proxifier: { enabled: true, listen: "127.0.0.1", port: 39091 },
    },
    ruleSets: [],
    groups: {
      processProxy: { type: "selector", includes: ["US"], defaultTarget: "US" },
      aiOut: { type: "selector", includes: ["HK", "US"], defaultTarget: "HK" },
      devCommonOut: { type: "selector", includes: ["HK", "US"], defaultTarget: "HK" },
      stitchOut: { type: "selector", includes: ["US"], defaultTarget: "US" },
      global: { type: "urltest", includes: ["HK", "US"] },
    },
    rules: {
      userRulesFile: path.join(dir, "custom.rules.yaml"),
    },
    verification: {
      scenarios: [],
    },
    schedule: {
      enabled: false,
      intervalMinutes: 30,
    },
    authoring: {
      provider: "deterministic",
      timeoutMs: 4000,
    },
  };
}
