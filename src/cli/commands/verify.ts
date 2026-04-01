import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import type { Command } from "commander";

import { buildConfigArtifact, resolveEffectiveIntent } from "../../modules/build/index.js";
import { buildDnsPlan } from "../../modules/dns-plan/index.js";
import { buildVerificationPlan } from "../../modules/verification-plan/index.js";
import {
  type DnsVerificationResult,
  type EgressVerificationResult,
  type ProtocolVerificationResult,
  assertVerificationReportPassed,
  verifyAppPlan,
  verifyConfigRoutes,
  verifyDnsPlan,
  verifyEgressPlan,
  verifyProtocolPlan,
} from "../../modules/verification/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerVerifyCommand(program: Command): void {
  program
    .command("verify")
    .description("Build and run closed-loop route verification with sing-box and Chrome.")
    .argument("[mode]", "verification scope: all, route, dns, egress, app, protocol", "all")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("-i, --input <path>", "path to an existing config JSON to verify")
    .option("--subscription-url <url>", "override subscription URL when rebuilding")
    .option("--subscription-file <path>", "use a local subscription file instead of fetching")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--chrome-bin <path>", "path to Chrome binary")
    .action(async (mode: VerifyMode, options: VerifyCommandOptions) => {
      let configPath = options.input;
      const builderConfig = await resolveBuilderConfig(options);
      let effectiveIntent = builderConfig ? await resolveEffectiveIntent(builderConfig) : undefined;
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
        effectiveIntent = result.intent;
      }

      if (!builderConfig || !effectiveIntent) {
        throw new Error(
          "Verification requires a builder config so the verification plan can be built.",
        );
      }

      const dnsPlan = buildDnsPlan({
        config: builderConfig,
        intent: effectiveIntent,
        activeRuleSetTags: builderConfig.ruleSets
          .filter((ruleSet) => existsSync(ruleSet.path))
          .map((ruleSet) => ruleSet.tag),
      });
      const verificationPlan = buildVerificationPlan({
        config: builderConfig,
        intent: effectiveIntent,
        dnsPlan,
      });
      const rawConfig = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;

      const lines = [`Verified config: ${configPath}`, `Mode: ${mode}`];

      if (mode === "all" || mode === "route") {
        const report = await verifyConfigRoutes({
          configPath,
          ...(options.singBoxBin ? { singBoxBinary: options.singBoxBin } : {}),
          ...(options.chromeBin ? { chromeBinary: options.chromeBin } : {}),
          configuredScenarios: builderConfig.verification.scenarios,
        });
        lines.push("");
        lines.push("Route checks:");
        lines.push(
          ...report.scenarios.map(
            (scenario) =>
              `- ${scenario.passed ? "PASS" : "FAIL"} ${scenario.name}: ${scenario.expectedOutboundTag} via ${scenario.inboundTag}`,
          ),
        );
        assertVerificationReportPassed(report);
      }

      if (mode === "all" || mode === "dns") {
        lines.push("");
        lines.push("DNS checks:");
        lines.push(...formatDnsChecks(verifyDnsPlan(verificationPlan, dnsPlan)));
      }

      if (mode === "all" || mode === "app") {
        lines.push("");
        lines.push("App checks:");
        lines.push(
          ...verifyAppPlan(verificationPlan, rawConfig).map(
            (check) =>
              `- ${check.passed ? "PASS" : "FAIL"} ${check.app}: ${check.expectedInbound} -> ${check.expectedOutboundGroup}`,
          ),
        );
      }

      if (mode === "all" || mode === "protocol") {
        lines.push("");
        lines.push("Protocol checks:");
        lines.push(...formatProtocolChecks(verifyProtocolPlan(verificationPlan, rawConfig)));
      }

      if (mode === "all" || mode === "egress") {
        const egressResults = await verifyEgressPlan({
          configPath,
          checks: verificationPlan.egressChecks,
          ...(options.singBoxBin ? { singBoxBinary: options.singBoxBin } : {}),
        });
        lines.push("");
        lines.push("Egress checks:");
        lines.push(...formatEgressChecks(egressResults));
      }

      process.stdout.write(`${lines.join("\n")}\n`);
    });
}

type VerifyMode = "all" | "route" | "dns" | "egress" | "app" | "protocol";

interface VerifyCommandOptions {
  readonly config?: string;
  readonly input?: string;
  readonly subscriptionUrl?: string;
  readonly subscriptionFile?: string;
  readonly singBoxBin?: string;
  readonly chromeBin?: string;
}

function formatDnsChecks(checks: readonly DnsVerificationResult[]): string[] {
  return checks.map(
    (check) =>
      `- ${check.passed ? "PASS" : "FAIL"} ${check.domain}: ${check.actualMode} via ${check.resolver}`,
  );
}

function formatProtocolChecks(checks: readonly ProtocolVerificationResult[]): string[] {
  return checks.map(
    (check) =>
      `- ${check.passed ? "PASS" : "FAIL"} ${new URL(check.target).hostname}: ${check.details}`,
  );
}

function formatEgressChecks(checks: readonly EgressVerificationResult[]): string[] {
  return checks.map((check) =>
    `- ${check.passed ? "PASS" : "FAIL"} ${check.expectedOutboundGroup}: ${check.ip ?? "unknown-ip"} ${check.country ?? ""} ${check.asn ?? ""}`.trim(),
  );
}
