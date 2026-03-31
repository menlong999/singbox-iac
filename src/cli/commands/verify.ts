import type { Command } from "commander";

import { buildConfigArtifact } from "../../modules/build/index.js";
import {
  assertVerificationReportPassed,
  verifyConfigRoutes,
} from "../../modules/verification/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerVerifyCommand(program: Command): void {
  program
    .command("verify")
    .description("Build and run closed-loop route verification with sing-box and Chrome.")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("-i, --input <path>", "path to an existing config JSON to verify")
    .option("--subscription-url <url>", "override subscription URL when rebuilding")
    .option("--subscription-file <path>", "use a local subscription file instead of fetching")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--chrome-bin <path>", "path to Chrome binary")
    .action(async (options: VerifyCommandOptions) => {
      let configPath = options.input;
      const builderConfig = await resolveBuilderConfig(options);
      if (!configPath) {
        if (!builderConfig) {
          throw new Error("Verification requires --input or a builder config.");
        }

        const result = await buildConfigArtifact({
          config: builderConfig,
          ...(options.subscriptionFile ? { subscriptionFile: options.subscriptionFile } : {}),
          ...(options.subscriptionUrl ? { subscriptionUrl: options.subscriptionUrl } : {}),
        });
        configPath = result.outputPath;
      }

      const report = await verifyConfigRoutes({
        configPath,
        ...(options.singBoxBin ? { singBoxBinary: options.singBoxBin } : {}),
        ...(options.chromeBin ? { chromeBinary: options.chromeBin } : {}),
        ...(builderConfig ? { configuredScenarios: builderConfig.verification.scenarios } : {}),
      });

      const lines = [
        `Verified config: ${report.configPath}`,
        `Verification config: ${report.verifyConfigPath}`,
        `sing-box log: ${report.logPath}`,
        "",
        "Static checks:",
        ...report.checks.map(
          (check) => `- ${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.details}`,
        ),
        "",
        "Runtime scenarios:",
        ...report.scenarios.map(
          (scenario) =>
            `- ${scenario.passed ? "PASS" : "FAIL"} ${scenario.name} -> ${scenario.expectedOutboundTag} (${scenario.inboundTag})`,
        ),
      ];

      process.stdout.write(`${lines.join("\n")}\n`);

      assertVerificationReportPassed(report);
    });
}

interface VerifyCommandOptions {
  readonly config?: string;
  readonly input?: string;
  readonly subscriptionUrl?: string;
  readonly subscriptionFile?: string;
  readonly singBoxBin?: string;
  readonly chromeBin?: string;
}
