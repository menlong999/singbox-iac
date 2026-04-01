import type { Command } from "commander";

import { listTransactionHistory } from "../../modules/transactions/index.js";
import { resolveBuilderConfig } from "../command-helpers.js";

export function registerHistoryCommand(program: Command): void {
  program
    .command("history")
    .description("Show recent publish transactions.")
    .option("-c, --config <path>", "path to builder config YAML")
    .action(async (options: { readonly config?: string }) => {
      const builderConfig = await resolveBuilderConfig(options);
      if (!builderConfig) {
        throw new Error("history requires a builder config.");
      }

      const entries = await listTransactionHistory(builderConfig);
      const lines = [
        `Transactions: ${entries.length}`,
        ...entries.map(
          (entry) =>
            `- ${entry.txId} ${entry.status} ${entry.startedAt} ${entry.generatedPath} -> ${entry.livePath}`,
        ),
      ];
      process.stdout.write(`${lines.join("\n")}\n`);
    });
}
