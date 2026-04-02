import type { BuilderConfig } from "../../config/schema.js";
import type { BuiltConfigArtifact } from "../build/index.js";
import { buildConfigArtifact } from "../build/index.js";
import { applyConfig } from "../manager/index.js";
import { shouldAutoReloadRuntime } from "../manager/index.js";
import { applyWithTransaction } from "../transactions/index.js";
import {
  type VerificationReport,
  assertVerificationReportPassed,
  verifyConfigRoutes,
} from "../verification/index.js";

export interface RunUpdateInput {
  readonly config: BuilderConfig;
  readonly outputPath?: string;
  readonly livePath?: string;
  readonly backupPath?: string;
  readonly subscriptionFile?: string;
  readonly subscriptionUrl?: string;
  readonly singBoxBinary?: string;
  readonly chromeBinary?: string;
  readonly verify?: boolean;
  readonly reload?: boolean;
}

export interface UpdateResult {
  readonly build: BuiltConfigArtifact;
  readonly verification?: VerificationReport;
  readonly livePath: string;
  readonly backupPath?: string;
  readonly reloaded: boolean;
  readonly transactionId: string;
}

export async function runUpdate(input: RunUpdateInput): Promise<UpdateResult> {
  const singBoxBinary = input.singBoxBinary ?? input.config.runtime.dependencies.singBoxBinary;
  const chromeBinary = input.chromeBinary ?? input.config.runtime.dependencies.chromeBinary;
  const build = await buildConfigArtifact({
    config: input.config,
    ...(input.outputPath ? { outputPath: input.outputPath } : {}),
    ...(input.subscriptionFile ? { subscriptionFile: input.subscriptionFile } : {}),
    ...(input.subscriptionUrl ? { subscriptionUrl: input.subscriptionUrl } : {}),
  });

  let verification: VerificationReport | undefined;
  if (input.verify !== false) {
    verification = await verifyConfigRoutes({
      configPath: build.outputPath,
      ...(singBoxBinary ? { singBoxBinary } : {}),
      ...(chromeBinary ? { chromeBinary } : {}),
      configuredScenarios: input.config.verification.scenarios,
    });
    assertVerificationReportPassed(verification);
  }

  const livePath = input.livePath ?? input.config.output.livePath;
  const backupPath = input.backupPath ?? input.config.output.backupPath;
  const reloaded = input.reload ?? (await shouldAutoReloadRuntime(input.config.runtime.reload));

  const transaction = await applyWithTransaction({
    config: input.config,
    generatedPath: build.outputPath,
    livePath,
    backupPath,
    verificationSummary: verification
      ? {
          routeScenariosPassed: verification.scenarios.filter((scenario) => scenario.passed).length,
          routeScenariosTotal: verification.scenarios.length,
        }
      : { routeScenariosSkipped: true },
    apply: async () => {
      await applyConfig({
        stagingPath: build.outputPath,
        livePath,
        ...(backupPath ? { backupPath } : {}),
        ...(singBoxBinary ? { singBoxBinary } : {}),
        reload: reloaded,
        runtime: input.config.runtime.reload,
      });
    },
  });

  return {
    build,
    ...(verification ? { verification } : {}),
    livePath,
    ...(backupPath ? { backupPath } : {}),
    reloaded,
    transactionId: transaction.txId,
  };
}
