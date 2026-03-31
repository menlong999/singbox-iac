import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/load-config.js";
import {
  listProxifierBundles,
  selectProxifierBundlesFromPrompt,
  writeProxifierScaffold,
} from "../../modules/proxifier/index.js";
import { getDefaultConfigDir, getDefaultConfigPath } from "../command-helpers.js";

export function registerProxifierCommand(program: Command): void {
  const proxifier = program
    .command("proxifier")
    .description("Generate Proxifier helper files for process-aware routing.");

  proxifier
    .command("bundles")
    .description("List supported Proxifier process bundles.")
    .action(() => {
      const lines = listProxifierBundles().map(
        (bundle) => `${bundle.id}: ${bundle.name}\n- ${bundle.description}`,
      );
      process.stdout.write(`${lines.join("\n")}\n`);
    });

  proxifier
    .command("scaffold")
    .description("Generate a Proxifier helper directory from the current listener config.")
    .option("-c, --config <path>", "path to builder config YAML", getDefaultConfigPath())
    .option(
      "--out-dir <path>",
      "output directory for Proxifier helper files",
      path.join(getDefaultConfigDir(), "proxifier"),
    )
    .option("--bundle <id>", "bundle id to include", collectOption, [])
    .option("--prompt <text>", "derive recommended bundles from a routing prompt")
    .action(async (options: ProxifierScaffoldCommandOptions) => {
      const config = await loadConfig(resolvePath(options.config));
      const promptBundleIds = options.prompt
        ? selectProxifierBundlesFromPrompt(options.prompt)
        : [];
      const bundleIds = [...new Set([...options.bundle, ...promptBundleIds])];

      const result = await writeProxifierScaffold({
        listener: {
          host: config.listeners.proxifier.listen,
          port: config.listeners.proxifier.port,
        },
        outputDir: resolvePath(options.outDir),
        ...(bundleIds.length > 0 ? { bundleIds } : {}),
      });

      const lines = [
        `Output: ${result.outputDir}`,
        `Guide: ${result.guidePath}`,
        `Proxy endpoint: ${result.proxyEndpointPath}`,
        `Custom processes: ${result.customProcessesPath}`,
      ];
      if (result.combinedProcessesPath) {
        lines.push(`Combined processes: ${result.combinedProcessesPath}`);
      }
      if (result.bundles.length > 0) {
        lines.push(`Bundles: ${result.bundles.map((bundle) => bundle.id).join(", ")}`);
      } else {
        lines.push("Bundles: none");
      }

      process.stdout.write(`${lines.join("\n")}\n`);
    });
}

interface ProxifierScaffoldCommandOptions {
  readonly config: string;
  readonly outDir: string;
  readonly bundle: string[];
  readonly prompt?: string;
}

function collectOption(value: string, previous: readonly string[]): string[] {
  return [...previous, value];
}

function resolvePath(filePath: string): string {
  return filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
}
