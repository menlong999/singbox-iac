import { homedir } from "node:os";
import path from "node:path";

import type { Command } from "commander";

import type { BuilderConfig } from "../../config/schema.js";
import { buildConfigArtifact } from "../../modules/build/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerBuildCommand(program: Command): void {
  program
    .command("build")
    .description("Fetch, parse, and compile a staging sing-box config.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--subscription-url <url>", "override subscription URL")
    .option("--subscription-file <path>", "use a local subscription file instead of fetching")
    .option("-o, --output <path>", "override output path")
    .action(async (options: BuildCommandOptions) => {
      const config = await resolveBuildConfig(options);
      const result = await buildConfigArtifact({
        config,
        ...(options.output ? { outputPath: options.output } : {}),
        ...(options.subscriptionFile ? { subscriptionFile: options.subscriptionFile } : {}),
        ...(options.subscriptionUrl ? { subscriptionUrl: options.subscriptionUrl } : {}),
      });

      const warnings = [...result.warnings];
      process.stdout.write(
        `${[
          `Generated ${result.nodeCount} nodes.`,
          `Output: ${result.outputPath}`,
          warnings.length > 0 ? `Warnings: ${warnings.length}` : "Warnings: 0",
        ].join("\n")}\n`,
      );

      if (warnings.length > 0) {
        process.stdout.write(`${warnings.map((warning) => `- ${warning}`).join("\n")}\n`);
      }
    });
}

interface BuildCommandOptions {
  readonly config?: string;
  readonly subscriptionUrl?: string;
  readonly subscriptionFile?: string;
  readonly output?: string;
}

async function resolveBuildConfig(options: BuildCommandOptions): Promise<BuilderConfig> {
  const builderConfig = await resolveBuilderConfig(options);
  if (builderConfig) {
    return builderConfig;
  }

  return {
    version: 1,
    subscription: {
      url: options.subscriptionUrl ?? "",
      format: "base64-lines",
      protocols: ["trojan"],
    },
    output: {
      stagingPath: options.output ?? path.resolve(process.cwd(), "config.json"),
      livePath: options.output ?? path.resolve(process.cwd(), "config.json"),
      backupPath: path.resolve(process.cwd(), "config.last-known-good.json"),
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
    ruleSets: [
      localRuleSet("geosite-cn"),
      localRuleSet("geoip-cn"),
      localRuleSet("geosite-google"),
      localRuleSet("geosite-google-gemini"),
      localRuleSet("geosite-google-deepmind"),
      localRuleSet("geosite-anthropic"),
      localRuleSet("geosite-github"),
      localRuleSet("geosite-github-copilot"),
      localRuleSet("geosite-cursor"),
      localRuleSet("geosite-figma"),
    ],
    groups: {
      processProxy: {
        type: "selector",
        includes: ["US", "SG", "JP", "HK"],
        defaultTarget: "US",
        defaultNodePattern: "OnlyAI",
      },
      aiOut: { type: "selector", includes: ["HK", "SG", "US", "JP"], defaultTarget: "HK" },
      devCommonOut: {
        type: "selector",
        includes: ["HK", "SG", "US", "JP"],
        defaultTarget: "HK",
      },
      stitchOut: { type: "selector", includes: ["US", "SG", "JP"], defaultTarget: "US" },
      global: { type: "urltest", includes: ["HK", "SG", "JP", "US"] },
    },
    rules: {
      userRulesFile: path.resolve(process.cwd(), "custom.rules.yaml"),
    },
    verification: {
      scenarios: [
        {
          id: "proxifier-google-favicon",
          name: "Proxifier Google traffic stays on the dedicated US path",
          url: "https://www.google.com/favicon.ico",
          inbound: "in-proxifier",
          expectedOutbound: "Process-Proxy",
        },
        {
          id: "proxifier-google-204",
          name: "Proxifier Google connectivity uses the dedicated US path",
          url: "https://www.gstatic.com/generate_204",
          inbound: "in-proxifier",
          expectedOutbound: "Process-Proxy",
        },
        {
          id: "stitch-us",
          name: "Google Stitch always uses the dedicated US exit",
          url: "https://stitch.withgoogle.com/favicon.ico",
          inbound: "in-mixed",
          expectedOutbound: "Stitch-Out",
        },
        {
          id: "cn-direct",
          name: "China traffic stays direct",
          url: "https://www.qq.com/favicon.ico",
          inbound: "in-mixed",
          expectedOutbound: "direct",
        },
        {
          id: "chatgpt-hk",
          name: "ChatGPT uses the HK default AI path",
          url: "https://chatgpt.com/favicon.ico",
          inbound: "in-mixed",
          expectedOutbound: "AI-Out",
        },
        {
          id: "openrouter-hk",
          name: "OpenRouter custom DSL rules send traffic to the HK AI path",
          url: "https://openrouter.ai/favicon.ico",
          inbound: "in-mixed",
          expectedOutbound: "AI-Out",
        },
        {
          id: "github-hk",
          name: "GitHub uses the HK default developer path",
          url: "https://github.com/favicon.ico",
          inbound: "in-mixed",
          expectedOutbound: "Dev-Common-Out",
        },
      ],
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

function localRuleSet(tag: string): {
  readonly tag: string;
  readonly format: "binary";
  readonly type: "local";
  readonly path: string;
} {
  return {
    tag,
    format: "binary",
    type: "local",
    path: path.join(homedir(), ".config", "sing-box", "rule-set", `${tag}.srs`),
  };
}
