import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { BuilderConfig } from "../../src/config/schema.js";
import type { DNSPlan } from "../../src/domain/dns-plan.js";
import type { IntentIR } from "../../src/domain/intent.js";
import type { NormalizedNode } from "../../src/domain/node.js";
import type { VerificationPlan } from "../../src/domain/verification-plan.js";
import { compileConfig } from "../../src/modules/compiler/index.js";
import { buildDnsPlan } from "../../src/modules/dns-plan/index.js";
import { buildVerificationPlan } from "../../src/modules/verification-plan/index.js";

interface RegressionFixtureGroupOverrides {
  readonly processProxy?: {
    readonly defaultTarget?: string;
    readonly defaultNodePattern?: string;
  };
  readonly aiOut?: {
    readonly defaultTarget?: string;
  };
  readonly devCommonOut?: {
    readonly defaultTarget?: string;
  };
  readonly stitchOut?: {
    readonly defaultTarget?: string;
  };
}

interface RegressionFixtureMetadata {
  readonly name: string;
  readonly activeRuleSetTags: readonly string[];
  readonly groupOverrides?: RegressionFixtureGroupOverrides;
  readonly verificationScenarios: readonly {
    readonly id: string;
    readonly name: string;
    readonly url: string;
    readonly inbound: "in-mixed" | "in-proxifier";
    readonly expectedOutbound: string;
  }[];
}

export interface RegressionFixture {
  readonly id: string;
  readonly dir: string;
  readonly metadata: RegressionFixtureMetadata;
  readonly intent: IntentIR;
  readonly dslPath?: string;
  readonly fixturePath: string;
  readonly intentPath: string;
  readonly compiledConfigPath: string;
  readonly verificationPlanPath: string;
}

export interface RegressionFixtureArtifacts {
  readonly compiledConfig: Record<string, unknown>;
  readonly verificationPlan: VerificationPlan;
  readonly dnsPlan: DNSPlan;
  readonly cleanup: () => void;
}

const regressionFixturesDir = path.resolve(process.cwd(), "tests/fixtures/regression");

const baseNodes: readonly NormalizedNode[] = [
  {
    protocol: "trojan",
    tag: "🇭🇰 香港 01",
    server: "hk.example.com",
    serverPort: 443,
    password: "pass-hk",
    sni: "hk.example.com",
    insecure: true,
    regionHint: "HK",
  },
  {
    protocol: "trojan",
    tag: "🇺🇸 美国 01",
    server: "us.example.com",
    serverPort: 443,
    password: "pass-us",
    sni: "us.example.com",
    regionHint: "US",
  },
  {
    protocol: "trojan",
    tag: "🇺🇸 美国 07 - OnlyAI",
    server: "us-onlyai.example.com",
    serverPort: 9443,
    password: "pass-us-onlyai",
    sni: "us-onlyai.example.com",
    regionHint: "US",
  },
  {
    protocol: "trojan",
    tag: "🇸🇬 新加坡 01",
    server: "sg.example.com",
    serverPort: 8443,
    password: "pass-sg",
    sni: "sg.example.com",
    regionHint: "SG",
  },
  {
    protocol: "trojan",
    tag: "🇯🇵 日本 01",
    server: "jp.example.com",
    serverPort: 10443,
    password: "pass-jp",
    sni: "jp.example.com",
    regionHint: "JP",
  },
];

export function listRegressionFixtures(): readonly RegressionFixture[] {
  return readdirSync(regressionFixturesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(regressionFixturesDir, entry.name);
      const fixturePath = path.join(dir, "fixture.json");
      const intentPath = path.join(dir, "intent.json");
      const compiledConfigPath = path.join(dir, "compiled-config.json");
      const verificationPlanPath = path.join(dir, "verification-plan.json");
      const dslPath = path.join(dir, "dsl.yaml");

      return {
        id: entry.name,
        dir,
        metadata: readJsonFile<RegressionFixtureMetadata>(fixturePath),
        intent: readJsonFile<IntentIR>(intentPath),
        dslPath: existsSync(dslPath) ? dslPath : undefined,
        fixturePath,
        intentPath,
        compiledConfigPath,
        verificationPlanPath,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function buildRegressionFixtureArtifacts(
  fixture: RegressionFixture,
): RegressionFixtureArtifacts {
  const tempDir = mkdtempSync(path.join(tmpdir(), `singbox-iac-regression-${fixture.id}-`));

  try {
    const config = createFixtureConfig(fixture.metadata, tempDir);
    const compiled = compileConfig({
      config,
      intent: fixture.intent,
      nodes: [...baseNodes],
    });
    const dnsPlan = buildDnsPlan({
      config,
      intent: fixture.intent,
      activeRuleSetTags: fixture.metadata.activeRuleSetTags,
    });
    const verificationPlan = buildVerificationPlan({
      config,
      intent: fixture.intent,
      dnsPlan,
    });

    return {
      compiledConfig: normalizeCompiledConfig(compiled.config),
      verificationPlan: normalizeJson(verificationPlan) as VerificationPlan,
      dnsPlan: normalizeJson(dnsPlan) as DNSPlan,
      cleanup: () => {
        rmSync(tempDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export function writeRegressionFixtureSnapshots(
  fixture: RegressionFixture,
  artifacts: Pick<RegressionFixtureArtifacts, "compiledConfig" | "verificationPlan">,
): void {
  writeJsonFile(fixture.compiledConfigPath, artifacts.compiledConfig);
  writeJsonFile(fixture.verificationPlanPath, artifacts.verificationPlan);
}

export function readFixtureSnapshot<T>(filePath: string): T {
  return readJsonFile<T>(filePath);
}

function createFixtureConfig(metadata: RegressionFixtureMetadata, tempDir: string): BuilderConfig {
  const ruleSetDir = path.join(tempDir, "rule-sets");
  mkdirSync(ruleSetDir, { recursive: true });

  const ruleSets = metadata.activeRuleSetTags.map((tag) => {
    const filePath = path.join(ruleSetDir, `${tag}.srs`);
    writeFileSync(filePath, "", "utf8");
    return {
      tag,
      format: "binary" as const,
      type: "local" as const,
      path: filePath,
    };
  });

  return {
    version: 1,
    subscription: {
      url: "https://example.com/subscription",
      format: "base64-lines",
      protocols: ["trojan"],
    },
    output: {
      stagingPath: "/tmp/staging.json",
      livePath: "/tmp/live.json",
      backupPath: "/tmp/backup.json",
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
      mixed: {
        enabled: true,
        listen: "127.0.0.1",
        port: 39097,
      },
      proxifier: {
        enabled: true,
        listen: "127.0.0.1",
        port: 39091,
      },
    },
    ruleSets,
    groups: {
      processProxy: {
        type: "selector",
        includes: ["US", "SG"],
        defaultTarget: metadata.groupOverrides?.processProxy?.defaultTarget ?? "US",
        defaultNodePattern: metadata.groupOverrides?.processProxy?.defaultNodePattern ?? "OnlyAI",
      },
      aiOut: {
        type: "selector",
        includes: ["HK", "SG", "US", "JP"],
        defaultTarget: metadata.groupOverrides?.aiOut?.defaultTarget ?? "HK",
      },
      devCommonOut: {
        type: "selector",
        includes: ["HK", "SG", "US", "JP"],
        defaultTarget: metadata.groupOverrides?.devCommonOut?.defaultTarget ?? "HK",
      },
      stitchOut: {
        type: "selector",
        includes: ["US", "SG", "JP"],
        defaultTarget: metadata.groupOverrides?.stitchOut?.defaultTarget ?? "US",
      },
      global: {
        type: "urltest",
        includes: ["HK", "SG", "US", "JP"],
      },
    },
    rules: {
      userRulesFile: "/tmp/custom.rules.yaml",
    },
    verification: {
      scenarios: [...metadata.verificationScenarios],
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

function normalizeCompiledConfig(config: Record<string, unknown>): Record<string, unknown> {
  const normalized = normalizeJson(config) as Record<string, unknown>;
  const route = normalized.route as Record<string, unknown> | undefined;
  const ruleSets = Array.isArray(route?.rule_set)
    ? (route.rule_set as Array<Record<string, unknown>>)
    : [];

  for (const ruleSet of ruleSets) {
    if (typeof ruleSet.path === "string") {
      ruleSet.path = `<ruleset-dir>/${path.basename(ruleSet.path)}`;
    }
  }

  return normalized;
}

function normalizeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function writeJsonFile(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
