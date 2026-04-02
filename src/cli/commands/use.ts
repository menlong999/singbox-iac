import type { Command } from "commander";

import { runAuthorFlow } from "./author.js";

export function registerUseCommand(program: Command): void {
  const command = program
    .command("use")
    .description("Change routing policy with one sentence and apply it.")
    .argument("<prompt>", "one-sentence routing intent")
    .option("-c, --config <path>", "path to builder config YAML")
    .option("--preview", "print diffs without writing any files")
    .option("--diff", "print Intent IR and config diffs without writing any files")
    .option("--emit-intent-ir", "print the generated Intent IR and exit without writing files")
    .option("--strict", "reject ambiguous natural-language requests instead of guessing")
    .option("--subscription-url <url>", "override subscription URL when rebuilding")
    .option("--subscription-file <path>", "use a local subscription file instead of fetching")
    .option("--provider <provider>", "authoring provider: deterministic, auto, claude, exec")
    .option("--author-timeout-ms <ms>", "timeout for local AI CLI authoring")
    .option("--sing-box-bin <path>", "path to sing-box binary")
    .option("--chrome-bin <path>", "path to Chrome binary for runtime verification")
    .option("--skip-verify", "skip runtime verification before publish")
    .action(
      async (
        prompt: string,
        options: {
          readonly config?: string;
          readonly preview?: boolean;
          readonly diff?: boolean;
          readonly emitIntentIr?: boolean;
          readonly strict?: boolean;
          readonly subscriptionUrl?: string;
          readonly subscriptionFile?: string;
          readonly provider?: "deterministic" | "auto" | "claude" | "exec";
          readonly authorTimeoutMs?: string;
          readonly singBoxBin?: string;
          readonly chromeBin?: string;
          readonly skipVerify?: boolean;
        },
      ) => {
        await runAuthorFlow({
          prompt,
          execArg: [],
          label: "org.singbox-iac.update",
          ...(options.config ? { config: options.config } : {}),
          ...(options.preview ? { preview: true } : {}),
          ...(options.diff ? { diff: true } : {}),
          ...(options.emitIntentIr ? { emitIntentIr: true } : {}),
          ...(options.strict ? { strict: true } : {}),
          ...(options.subscriptionUrl ? { subscriptionUrl: options.subscriptionUrl } : {}),
          ...(options.subscriptionFile ? { subscriptionFile: options.subscriptionFile } : {}),
          ...(options.provider ? { provider: options.provider } : {}),
          ...(options.authorTimeoutMs ? { authorTimeoutMs: options.authorTimeoutMs } : {}),
          ...(options.singBoxBin ? { singBoxBin: options.singBoxBin } : {}),
          ...(options.chromeBin ? { chromeBin: options.chromeBin } : {}),
          ...(options.skipVerify ? { skipVerify: true } : {}),
          update: true,
        });
      },
    );

  for (const optionName of [
    "preview",
    "subscriptionUrl",
    "subscriptionFile",
    "provider",
    "authorTimeoutMs",
    "singBoxBin",
    "chromeBin",
    "skipVerify",
  ]) {
    command.options.find((entry) => entry.attributeName() === optionName)?.hideHelp();
  }
}
