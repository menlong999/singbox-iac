import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import {
  type ProcessBundleSpec as ProxifierBundleSpec,
  type ProcessBundleMatcher as ProxifierProcessMatcher,
  getProcessBundle,
  listProcessBundles,
  selectProcessBundlesFromText,
} from "../bundle-registry/index.js";

export interface ProxifierListenerConfig {
  readonly host: string;
  readonly port: number;
}

export interface ProxifierScaffoldInput {
  readonly listener: ProxifierListenerConfig;
  readonly outputDir: string;
  readonly bundleIds?: readonly string[];
}

export interface ProxifierScaffoldResult {
  readonly outputDir: string;
  readonly guidePath: string;
  readonly proxyEndpointPath: string;
  readonly customProcessesPath: string;
  readonly combinedProcessesPath?: string;
  readonly bundlePaths: readonly string[];
  readonly bundleSpecPaths: readonly string[];
  readonly bundles: readonly ProxifierBundleSpec[];
}

export function listProxifierBundles(): readonly ProxifierBundleSpec[] {
  return listProcessBundles();
}

export function getProxifierBundle(id: string): ProxifierBundleSpec | undefined {
  return getProcessBundle(id);
}

export function renderProxifierBundleSpec(bundle: ProxifierBundleSpec): string {
  return YAML.stringify({
    id: bundle.id,
    name: bundle.name,
    description: bundle.description,
    promptAliases: [...bundle.promptAliases],
    targetInbound: bundle.targetInbound,
    targetOutboundGroup: bundle.targetOutboundGroup,
    tags: [...bundle.tags],
    processMatchers: bundle.processMatchers,
    ...(bundle.notes && bundle.notes.length > 0 ? { notes: [...bundle.notes] } : {}),
  });
}

export function selectProxifierBundlesFromPrompt(prompt: string): readonly string[] {
  return selectProcessBundlesFromText(prompt).map((bundle) => bundle.id);
}

export async function writeProxifierScaffold(
  input: ProxifierScaffoldInput,
): Promise<ProxifierScaffoldResult> {
  const bundles = resolveBundles(input.bundleIds);
  await mkdir(input.outputDir, { recursive: true });
  const bundlesDir = path.join(input.outputDir, "bundles");
  const specsDir = path.join(input.outputDir, "bundle-specs");
  await Promise.all([mkdir(bundlesDir, { recursive: true }), mkdir(specsDir, { recursive: true })]);

  const guidePath = path.join(input.outputDir, "README.md");
  const proxyEndpointPath = path.join(input.outputDir, "proxy-endpoint.txt");
  const customProcessesPath = path.join(input.outputDir, "custom-processes.txt");

  const proxyEndpointText = [
    "Proxy Endpoint",
    "Protocol: SOCKS5",
    `Host: ${input.listener.host}`,
    `Port: ${input.listener.port}`,
    "",
    "Recommended Proxifier target",
    `SOCKS5 ${input.listener.host}:${input.listener.port}`,
    "",
  ].join("\n");

  await writeFile(proxyEndpointPath, proxyEndpointText, "utf8");
  await writeFile(
    customProcessesPath,
    [
      "# Add your own process names here, one per line.",
      "# Example:",
      "# MyIDE.app",
      "# my-language-server",
      "",
    ].join("\n"),
    "utf8",
  );

  const bundlePaths: string[] = [];
  const bundleSpecPaths: string[] = [];
  const combinedProcesses = new Set<string>();

  for (const bundle of bundles) {
    const bundlePath = path.join(bundlesDir, `${bundle.id}.txt`);
    const bundleSpecPath = path.join(specsDir, `${bundle.id}.yaml`);
    const processNames = collectDisplayProcessNames(bundle.processMatchers);

    await Promise.all([
      writeFile(
        bundlePath,
        [`# ${bundle.name}`, `# ${bundle.description}`, ...processNames, ""].join("\n"),
        "utf8",
      ),
      writeFile(bundleSpecPath, renderProxifierBundleSpec(bundle), "utf8"),
    ]);

    bundlePaths.push(bundlePath);
    bundleSpecPaths.push(bundleSpecPath);
    for (const processName of processNames) {
      combinedProcesses.add(processName);
    }
  }

  let combinedProcessesPath: string | undefined;
  if (combinedProcesses.size > 0) {
    combinedProcessesPath = path.join(input.outputDir, "all-processes.txt");
    await writeFile(combinedProcessesPath, [...combinedProcesses].join("\n").concat("\n"), "utf8");
  }

  await writeFile(
    guidePath,
    renderGuide({
      listener: input.listener,
      bundles,
      bundlePaths,
      bundleSpecPaths,
      customProcessesPath,
      ...(combinedProcessesPath ? { combinedProcessesPath } : {}),
    }),
    "utf8",
  );

  return {
    outputDir: input.outputDir,
    guidePath,
    proxyEndpointPath,
    customProcessesPath,
    ...(combinedProcessesPath ? { combinedProcessesPath } : {}),
    bundlePaths,
    bundleSpecPaths,
    bundles,
  };
}

function resolveBundles(bundleIds?: readonly string[]): readonly ProxifierBundleSpec[] {
  if (!bundleIds || bundleIds.length === 0) {
    return [];
  }

  const requested = new Set(bundleIds);
  return listProcessBundles().filter((bundle) => requested.has(bundle.id));
}

function renderGuide(input: {
  readonly listener: ProxifierListenerConfig;
  readonly bundles: readonly ProxifierBundleSpec[];
  readonly bundlePaths: readonly string[];
  readonly bundleSpecPaths: readonly string[];
  readonly customProcessesPath: string;
  readonly combinedProcessesPath?: string;
}): string {
  const lines = [
    "# Proxifier Onboarding",
    "",
    "Use this directory to configure process-aware routing into `in-proxifier`.",
    "",
    "## Proxy Server",
    "",
    "- Protocol: `SOCKS5`",
    `- Host: \`${input.listener.host}\``,
    `- Port: \`${input.listener.port}\``,
    "",
    "## Suggested Steps",
    "",
    "1. Open Proxifier and create a new proxy server using the SOCKS5 endpoint above.",
    "2. Create or update a Proxification Rule that sends selected applications to that proxy server.",
    "3. Import process names from the bundle files below, then add any project-specific processes to `custom-processes.txt`.",
    "4. Keep the catch-all browser and normal system traffic on the regular mixed listener instead of sending everything through Proxifier.",
    "",
    "## Generated Files",
    "",
    "- Proxy endpoint: `proxy-endpoint.txt`",
    `- Custom process list: \`${path.basename(input.customProcessesPath)}\``,
  ];

  if (input.combinedProcessesPath) {
    lines.push(`- Combined process list: \`${path.basename(input.combinedProcessesPath)}\``);
  }

  if (input.bundles.length > 0) {
    lines.push("", "## Suggested Bundles", "");
    for (let index = 0; index < input.bundles.length; index += 1) {
      const bundle = input.bundles[index];
      const bundlePath = input.bundlePaths[index];
      const bundleSpecPath = input.bundleSpecPaths[index];
      if (!bundle || !bundlePath || !bundleSpecPath) {
        continue;
      }
      lines.push(
        `- \`${bundle.name}\`: processes \`${path.relative(
          path.dirname(input.customProcessesPath),
          bundlePath,
        )}\`, spec \`${path.relative(path.dirname(input.customProcessesPath), bundleSpecPath)}\``,
      );
      lines.push(`  - inbound: \`${bundle.targetInbound}\``);
      lines.push(`  - outbound: \`${bundle.targetOutboundGroup}\``);
      lines.push(`  - aliases: ${bundle.promptAliases.join(", ")}`);
    }
  }

  return lines.join("\n").concat("\n");
}

function collectDisplayProcessNames(
  matchers: readonly ProxifierProcessMatcher[],
): readonly string[] {
  const values = new Set<string>();
  for (const matcher of matchers) {
    if (matcher.processName) {
      values.add(matcher.processName);
    }
    if (matcher.bundleId) {
      values.add(`bundle:${matcher.bundleId}`);
    }
    if (matcher.pathRegex) {
      values.add(`regex:${matcher.pathRegex}`);
    }
  }
  return [...values];
}
