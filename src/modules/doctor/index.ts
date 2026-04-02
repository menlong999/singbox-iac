import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir, platform } from "node:os";
import path from "node:path";

import type { BuilderConfig } from "../../config/schema.js";
import { detectLocalAiClis } from "../authoring/index.js";
import {
  type ResolvedRuntimeDependency,
  resolveChromeDependency,
  resolveSingBoxDependency,
} from "../runtime-dependencies/index.js";

export interface DoctorInput {
  readonly config?: BuilderConfig;
  readonly configPath?: string;
  readonly singBoxBinary?: string;
  readonly chromeBinary?: string;
  readonly launchAgentsDir?: string;
}

export interface DoctorCheck {
  readonly status: "PASS" | "WARN" | "FAIL";
  readonly name: string;
  readonly details: string;
}

export interface DoctorReport {
  readonly checks: readonly DoctorCheck[];
  readonly resolvedDependencies: {
    readonly singBox?: ResolvedRuntimeDependency;
    readonly chrome?: ResolvedRuntimeDependency;
  };
}

export async function runDoctor(input: DoctorInput): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  let resolvedSingBox: ResolvedRuntimeDependency | undefined;
  let resolvedChrome: ResolvedRuntimeDependency | undefined;

  checks.push(makeCheck(platform() === "darwin" ? "PASS" : "WARN", "os", `platform=${platform()}`));

  if (input.config && input.configPath) {
    checks.push(makeCheck("PASS", "builder-config", input.configPath));
  } else {
    checks.push(
      makeCheck(
        "WARN",
        "builder-config",
        "No builder config was found. Use init or pass --config when running commands.",
      ),
    );
  }

  {
    const result = await checkBinary(
      "sing-box",
      () =>
        resolveSingBoxDependency({
          explicitPath: input.singBoxBinary,
          persistedPath: input.config?.runtime.dependencies.singBoxBinary,
        }),
      "FAIL",
      input.config?.runtime.dependencies.singBoxBinary,
    );
    checks.push(result.check);
    resolvedSingBox = result.resolved;
  }

  {
    const result = await checkBinary(
      "chrome",
      () =>
        resolveChromeDependency({
          explicitPath: input.chromeBinary,
          persistedPath: input.config?.runtime.dependencies.chromeBinary,
        }),
      "WARN",
      input.config?.runtime.dependencies.chromeBinary,
    );
    checks.push(result.check);
    resolvedChrome = result.resolved;
  }

  const localAiClis = await detectLocalAiClis();
  const installedAiClis = localAiClis.filter((cli) => cli.installed);
  checks.push(
    installedAiClis.length > 0
      ? makeCheck(
          "PASS",
          "local-ai-clis",
          installedAiClis
            .map((cli) => `${cli.id}=${cli.path} (${cli.authoringSupport})`)
            .join(", "),
        )
      : makeCheck(
          "WARN",
          "local-ai-clis",
          "No local AI CLI was detected. Natural-language authoring will use the deterministic parser unless an exec provider is configured.",
        ),
  );

  const launchAgentsDir = input.launchAgentsDir ?? path.join(homedir(), "Library", "LaunchAgents");
  checks.push(
    (await isDirectoryWritable(launchAgentsDir))
      ? makeCheck("PASS", "launch-agents-dir", launchAgentsDir)
      : makeCheck("WARN", "launch-agents-dir", `Directory not writable: ${launchAgentsDir}`),
  );

  if (input.config) {
    checks.push(
      (await pathExists(input.config.rules.userRulesFile))
        ? makeCheck("PASS", "user-rules-file", input.config.rules.userRulesFile)
        : makeCheck(
            "WARN",
            "user-rules-file",
            `Missing user rules file: ${input.config.rules.userRulesFile}`,
          ),
    );

    for (const ruleSet of input.config.ruleSets) {
      checks.push(
        (await pathExists(ruleSet.path))
          ? makeCheck("PASS", `rule-set:${ruleSet.tag}`, ruleSet.path)
          : makeCheck("WARN", `rule-set:${ruleSet.tag}`, `Missing file: ${ruleSet.path}`),
      );
    }

    checks.push(
      makeCheck(
        input.config.schedule.enabled ? "PASS" : "WARN",
        "schedule-config",
        `enabled=${String(input.config.schedule.enabled)}, intervalMinutes=${String(
          input.config.schedule.intervalMinutes,
        )}`,
      ),
    );

    const authoringProvider = input.config.authoring.provider;
    const authoringStatus =
      authoringProvider === "deterministic"
        ? "PASS"
        : authoringProvider === "auto"
          ? "PASS"
          : authoringProvider === "claude"
            ? localAiClis.some((cli) => cli.id === "claude" && cli.installed)
              ? "PASS"
              : "WARN"
            : input.config.authoring.exec?.command
              ? "PASS"
              : "WARN";
    const authoringDetails =
      authoringProvider === "exec"
        ? `provider=${authoringProvider}, timeoutMs=${input.config.authoring.timeoutMs}, command=${
            input.config.authoring.exec?.command ?? "(unset)"
          }`
        : `provider=${authoringProvider}, timeoutMs=${input.config.authoring.timeoutMs}`;
    checks.push(makeCheck(authoringStatus, "authoring-provider", authoringDetails));
  }

  return {
    checks,
    resolvedDependencies: {
      ...(resolvedSingBox ? { singBox: resolvedSingBox } : {}),
      ...(resolvedChrome ? { chrome: resolvedChrome } : {}),
    },
  };
}

async function checkBinary(
  name: string,
  resolver: () => Promise<ResolvedRuntimeDependency>,
  failureStatus: "WARN" | "FAIL",
  persistedPath?: string,
): Promise<{ check: DoctorCheck; resolved?: ResolvedRuntimeDependency }> {
  try {
    const resolved = await resolver();
    const status =
      persistedPath && resolved.source !== "persisted" && resolved.source !== "explicit"
        ? "WARN"
        : "PASS";
    const details =
      persistedPath && resolved.source !== "persisted" && resolved.source !== "explicit"
        ? `${resolved.path} (source=${resolved.source}, persisted path unavailable: ${persistedPath})`
        : `${resolved.path} (source=${resolved.source})`;
    return { check: makeCheck(status, name, details), resolved };
  } catch (error) {
    return {
      check: makeCheck(failureStatus, name, error instanceof Error ? error.message : String(error)),
    };
  }
}

function makeCheck(status: DoctorCheck["status"], name: string, details: string): DoctorCheck {
  return { status, name, details };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isDirectoryWritable(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
