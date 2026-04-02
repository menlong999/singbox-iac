import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/load-config.js";
import {
  getProxifierBundle,
  listProxifierBundles,
  renderProxifierBundleSpec,
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
    .description("List supported Proxifier bundles, show one bundle, or render one bundle spec.")
    .argument("[operation]", "show or render")
    .argument("[id]", "bundle id")
    .option("--out <path>", "write the rendered bundle spec to a file")
    .action(async (operation?: string, id?: string, options?: { readonly out?: string }) => {
      if (!operation) {
        const lines = listProxifierBundles().map(
          (bundle) =>
            `${bundle.id}: ${bundle.name}\n- ${bundle.description}\n- inbound: ${bundle.targetInbound}, outbound: ${bundle.targetOutboundGroup}`,
        );
        process.stdout.write(`${lines.join("\n")}\n`);
        return;
      }

      if (!["show", "render"].includes(operation)) {
        throw new Error(`Unknown proxifier bundle operation: ${operation}`);
      }
      if (!id) {
        throw new Error(`proxifier bundles ${operation} requires a bundle id.`);
      }

      const bundle = getProxifierBundle(id);
      if (!bundle) {
        throw new Error(`Unknown Proxifier bundle: ${id}`);
      }

      if (operation === "show") {
        const lines = [
          `ID: ${bundle.id}`,
          `Name: ${bundle.name}`,
          `Description: ${bundle.description}`,
          `Inbound: ${bundle.targetInbound}`,
          `Outbound: ${bundle.targetOutboundGroup}`,
          "Matchers:",
          ...bundle.processMatchers.map((matcher) => {
            if (matcher.processName) {
              return `- processName: ${matcher.processName}`;
            }
            if (matcher.bundleId) {
              return `- bundleId: ${matcher.bundleId}`;
            }
            return `- pathRegex: ${matcher.pathRegex ?? ""}`;
          }),
        ];
        if (bundle.notes && bundle.notes.length > 0) {
          lines.push("Notes:");
          lines.push(...bundle.notes.map((note) => `- ${note}`));
        }

        process.stdout.write(`${lines.join("\n")}\n`);
        return;
      }

      const rendered = renderProxifierBundleSpec(bundle);
      if (options?.out) {
        const outputPath = resolvePath(options.out);
        await writeBundleSpec(outputPath, rendered);
        process.stdout.write(`Bundle spec: ${outputPath}\n`);
        return;
      }

      process.stdout.write(rendered);
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
        lines.push(`Bundle specs: ${result.bundleSpecPaths.join(", ")}`);
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

async function writeBundleSpec(filePath: string, rendered: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, rendered, "utf8");
}
