import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ProxifierListenerConfig {
  readonly host: string;
  readonly port: number;
}

export interface ProxifierBundle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly processes: readonly string[];
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
  readonly bundles: readonly ProxifierBundle[];
}

const bundleDefinitions: readonly ProxifierBundle[] = [
  {
    id: "antigravity",
    name: "Antigravity",
    description: "Recommended process patterns for Google Antigravity and its language services.",
    processes: [
      "Antigravity.app",
      "Antigravity",
      "com.google.antigravity",
      "*Antigravity*",
      "language_server_macos_arm",
      "antigravity-auto-updater",
      "*antigravity*",
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    description: "Common Cursor desktop and helper process names.",
    processes: ["Cursor", "Cursor.app", "Cursor Helper", "cursor", "*cursor*"],
  },
  {
    id: "developer-ai-cli",
    name: "Developer AI CLI",
    description: "Common developer-facing AI and coding tool process names.",
    processes: [
      "claude",
      "codex",
      "gemini",
      "codebuddy",
      "cbc",
      "opencode",
      "qoder",
      "qodercli",
      "trae",
    ],
  },
];

const promptBundleAliases: Readonly<Record<string, readonly string[]>> = {
  antigravity: ["antigravity", "google antigravity", "google.antigravity"],
  cursor: ["cursor"],
  "developer-ai-cli": [
    "claude",
    "codex",
    "gemini",
    "codebuddy",
    "opencode",
    "qoder",
    "trae",
    "ai ide",
    "ai cli",
  ],
};

export function listProxifierBundles(): readonly ProxifierBundle[] {
  return bundleDefinitions;
}

export function selectProxifierBundlesFromPrompt(prompt: string): readonly string[] {
  const normalized = prompt.toLowerCase();
  const matched = new Set<string>();

  if (
    normalized.includes("proxifier") ||
    normalized.includes("进程级") ||
    normalized.includes("process-level") ||
    normalized.includes("独立入口")
  ) {
    matched.add("developer-ai-cli");
    matched.add("antigravity");
  }

  for (const [bundleId, aliases] of Object.entries(promptBundleAliases)) {
    if (aliases.some((alias) => normalized.includes(alias))) {
      matched.add(bundleId);
    }
  }

  return [...matched];
}

export async function writeProxifierScaffold(
  input: ProxifierScaffoldInput,
): Promise<ProxifierScaffoldResult> {
  const bundles = resolveBundles(input.bundleIds);
  await mkdir(input.outputDir, { recursive: true });
  const bundlesDir = path.join(input.outputDir, "bundles");
  await mkdir(bundlesDir, { recursive: true });

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
  const combinedProcesses = new Set<string>();

  for (const bundle of bundles) {
    const filePath = path.join(bundlesDir, `${bundle.id}.txt`);
    await writeFile(
      filePath,
      [`# ${bundle.name}`, `# ${bundle.description}`, ...bundle.processes, ""].join("\n"),
      "utf8",
    );
    bundlePaths.push(filePath);
    for (const processName of bundle.processes) {
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
    bundles,
  };
}

function resolveBundles(bundleIds?: readonly string[]): readonly ProxifierBundle[] {
  if (!bundleIds || bundleIds.length === 0) {
    return [];
  }

  const requested = new Set(bundleIds);
  return bundleDefinitions.filter((bundle) => requested.has(bundle.id));
}

function renderGuide(input: {
  readonly listener: ProxifierListenerConfig;
  readonly bundles: readonly ProxifierBundle[];
  readonly bundlePaths: readonly string[];
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
      if (!bundle || !bundlePath) {
        continue;
      }
      lines.push(
        `- \`${bundle.name}\`: \`${path.relative(path.dirname(input.customProcessesPath), bundlePath)}\``,
      );
    }
  } else {
    lines.push(
      "",
      "## Suggested Bundles",
      "",
      "- No specific bundle matched the current prompt. Start with `custom-processes.txt` and add your target app names manually.",
    );
  }

  return `${lines.join("\n")}\n`;
}
