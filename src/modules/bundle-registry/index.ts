export interface SiteBundleSpec {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly domainSuffixes: readonly string[];
  readonly verificationUrls: readonly string[];
  readonly tags: readonly string[];
}

export interface ProcessBundleMatcher {
  readonly processName?: string;
  readonly bundleId?: string;
  readonly pathRegex?: string;
}

export interface ProcessBundleSpec {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly promptAliases: readonly string[];
  readonly processMatchers: readonly ProcessBundleMatcher[];
  readonly targetInbound: "in-proxifier";
  readonly targetOutboundGroup: string;
  readonly tags: readonly string[];
  readonly notes?: readonly string[];
}

const genericProcessIntentAliases = [
  "proxifier",
  "进程级",
  "独立入口",
  "独立的入口",
  "process-level",
  "process level",
];

const siteBundleDefinitions: readonly SiteBundleSpec[] = [
  {
    id: "notebooklm",
    name: "NotebookLM",
    aliases: ["notebooklm", "notebook lm"],
    domainSuffixes: ["notebooklm.google.com"],
    verificationUrls: ["https://notebooklm.google.com/favicon.ico"],
    tags: ["ai", "google"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    aliases: ["openrouter"],
    domainSuffixes: ["openrouter.ai"],
    verificationUrls: ["https://openrouter.ai/favicon.ico"],
    tags: ["ai"],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    aliases: ["perplexity"],
    domainSuffixes: ["perplexity.ai"],
    verificationUrls: ["https://www.perplexity.ai/favicon.ico"],
    tags: ["ai"],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    aliases: ["chatgpt"],
    domainSuffixes: ["chatgpt.com"],
    verificationUrls: ["https://chatgpt.com/favicon.ico"],
    tags: ["ai", "openai"],
  },
  {
    id: "openai",
    name: "OpenAI",
    aliases: ["openai", "openai api"],
    domainSuffixes: ["openai.com", "api.openai.com"],
    verificationUrls: ["https://openai.com/favicon.ico"],
    tags: ["ai"],
  },
  {
    id: "gemini",
    name: "Gemini",
    aliases: ["gemini", "google gemini"],
    domainSuffixes: ["gemini.google.com"],
    verificationUrls: ["https://gemini.google.com/favicon.ico"],
    tags: ["ai", "google"],
  },
  {
    id: "anthropic",
    name: "Anthropic / Claude",
    aliases: ["anthropic", "claude", "claude ai"],
    domainSuffixes: ["anthropic.com", "claude.ai"],
    verificationUrls: ["https://claude.ai/favicon.ico"],
    tags: ["ai"],
  },
  {
    id: "github",
    name: "GitHub",
    aliases: ["github", "github copilot"],
    domainSuffixes: ["github.com", "githubusercontent.com"],
    verificationUrls: ["https://github.com/favicon.ico"],
    tags: ["developer"],
  },
  {
    id: "google-services",
    name: "Google Services",
    aliases: ["google 服务", "google services"],
    domainSuffixes: ["google.com", "googleapis.com", "gstatic.com", "googlevideo.com"],
    verificationUrls: ["https://www.google.com/favicon.ico"],
    tags: ["google", "services"],
  },
  {
    id: "apple-services",
    name: "Apple Services",
    aliases: ["apple 服务", "apple services", "icloud"],
    domainSuffixes: ["apple.com", "icloud.com", "mzstatic.com"],
    verificationUrls: ["https://www.icloud.com/favicon.ico"],
    tags: ["apple", "services"],
  },
  {
    id: "google-stitch",
    name: "Google Stitch",
    aliases: ["google stitch", "stitch"],
    domainSuffixes: ["stitch.withgoogle.com"],
    verificationUrls: ["https://stitch.withgoogle.com/favicon.ico"],
    tags: ["google", "developer"],
  },
  {
    id: "google-tv",
    name: "Google TV",
    aliases: ["google tv"],
    domainSuffixes: ["tv.youtube.com"],
    verificationUrls: ["https://tv.youtube.com/favicon.ico"],
    tags: ["video", "google"],
  },
  {
    id: "youtube",
    name: "YouTube",
    aliases: ["youtube"],
    domainSuffixes: ["youtube.com", "youtu.be"],
    verificationUrls: ["https://www.youtube.com/favicon.ico"],
    tags: ["video"],
  },
  {
    id: "netflix",
    name: "Netflix",
    aliases: ["netflix"],
    domainSuffixes: ["netflix.com", "nflxvideo.net"],
    verificationUrls: ["https://www.netflix.com/favicon.ico"],
    tags: ["video"],
  },
  {
    id: "amazon-prime",
    name: "Amazon Prime Video",
    aliases: ["amazon prime", "prime video", "primevideo", "amazon video"],
    domainSuffixes: ["primevideo.com", "amazonvideo.com"],
    verificationUrls: ["https://www.primevideo.com/favicon.ico"],
    tags: ["video"],
  },
  {
    id: "disney-plus",
    name: "Disney+",
    aliases: ["disney+", "disney plus", "disneyplus"],
    domainSuffixes: ["disneyplus.com", "disney-plus.net"],
    verificationUrls: ["https://www.disneyplus.com/favicon.ico"],
    tags: ["video"],
  },
  {
    id: "apple-tv",
    name: "Apple TV",
    aliases: ["apple tv"],
    domainSuffixes: ["tv.apple.com"],
    verificationUrls: ["https://tv.apple.com/favicon.ico"],
    tags: ["video", "apple"],
  },
  {
    id: "bilibili",
    name: "Bilibili",
    aliases: ["bilibili", "b站"],
    domainSuffixes: ["bilibili.com", "bilibili.tv"],
    verificationUrls: ["https://www.bilibili.com/favicon.ico"],
    tags: ["video", "cn"],
  },
  {
    id: "iqiyi",
    name: "iQIYI",
    aliases: ["iqiyi", "爱奇艺"],
    domainSuffixes: ["iqiyi.com", "iq.com"],
    verificationUrls: ["https://www.iqiyi.com/favicon.ico"],
    tags: ["video", "cn"],
  },
  {
    id: "youku",
    name: "Youku",
    aliases: ["youku", "优酷"],
    domainSuffixes: ["youku.com"],
    verificationUrls: ["https://www.youku.com/favicon.ico"],
    tags: ["video", "cn"],
  },
  {
    id: "mgtv",
    name: "MGTV",
    aliases: ["mgtv", "芒果tv", "芒果"],
    domainSuffixes: ["mgtv.com"],
    verificationUrls: ["https://www.mgtv.com/favicon.ico"],
    tags: ["video", "cn"],
  },
];

const processBundleDefinitions: readonly ProcessBundleSpec[] = [
  {
    id: "antigravity",
    name: "Antigravity",
    description: "Google Antigravity desktop app, helpers, and language services.",
    promptAliases: ["antigravity", "google antigravity", "google.antigravity"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["ai", "desktop", "google"],
    processMatchers: [
      { processName: "Antigravity.app" },
      { processName: "Antigravity" },
      { bundleId: "com.google.antigravity" },
      { processName: "*Antigravity*" },
      { processName: "language_server_macos_arm" },
      { processName: "antigravity-auto-updater" },
      { processName: "*antigravity*" },
    ],
    notes: [
      "Use this bundle when Antigravity or its language server does not honor the normal system proxy path.",
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    description: "Cursor desktop app and helper processes.",
    promptAliases: ["cursor"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["developer", "desktop", "editor"],
    processMatchers: [
      { processName: "Cursor" },
      { processName: "Cursor.app" },
      { processName: "Cursor Helper" },
      { processName: "cursor" },
      { processName: "*cursor*" },
    ],
  },
  {
    id: "vscode",
    name: "VS Code",
    description: "Visual Studio Code desktop app, helper processes, and CLI entrypoints.",
    promptAliases: ["vscode", "vs code", "visual studio code", "code helper"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["developer", "desktop", "editor"],
    processMatchers: [
      { processName: "Visual Studio Code" },
      { processName: "Code" },
      { processName: "Code Helper" },
      { bundleId: "com.microsoft.VSCode" },
      { processName: "code" },
    ],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Claude CLI and related coding-agent processes.",
    promptAliases: ["claude code", "claude cli"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["ai", "cli", "developer"],
    processMatchers: [{ processName: "claude" }, { processName: "claude-code" }],
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    description: "Gemini CLI and related local agent processes.",
    promptAliases: ["gemini cli"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["ai", "cli", "developer"],
    processMatchers: [{ processName: "gemini" }, { processName: "gemini-cli" }],
  },
  {
    id: "codex",
    name: "Codex",
    description: "Codex desktop or CLI agent processes.",
    promptAliases: ["codex", "codex cli"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["ai", "cli", "developer"],
    processMatchers: [{ processName: "codex" }, { processName: "codex-cli" }],
  },
  {
    id: "copilot-cli",
    name: "Copilot CLI",
    description: "GitHub Copilot CLI-style developer tooling processes.",
    promptAliases: ["copilot cli", "copilot", "github copilot"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["developer", "cli", "github"],
    processMatchers: [
      { processName: "copilot" },
      { processName: "github-copilot" },
      { processName: "copilot-cli" },
    ],
  },
  {
    id: "codebuddy",
    name: "CodeBuddy",
    description: "CodeBuddy / CBC local coding assistant CLIs.",
    promptAliases: ["codebuddy", "cbc"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["ai", "cli", "developer"],
    processMatchers: [{ processName: "codebuddy" }, { processName: "cbc" }],
  },
  {
    id: "opencode",
    name: "OpenCode",
    description: "OpenCode local coding agent CLI.",
    promptAliases: ["opencode"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["ai", "cli", "developer"],
    processMatchers: [{ processName: "opencode" }],
  },
  {
    id: "qoder",
    name: "Qoder CLI",
    description: "Qoder local coding assistant CLI.",
    promptAliases: ["qoder", "qodercli"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["ai", "cli", "developer"],
    processMatchers: [{ processName: "qoder" }, { processName: "qodercli" }],
  },
  {
    id: "trae",
    name: "Trae",
    description: "Trae local AI coding launcher and helper processes.",
    promptAliases: ["trae"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["ai", "developer", "tooling"],
    processMatchers: [{ processName: "trae" }],
  },
  {
    id: "developer-ai-cli",
    name: "Developer AI CLI",
    description: "A convenience bundle for common coding-agent and AI CLI tools.",
    promptAliases: ["ai ide", "ai cli", "coding agent", "developer ai"],
    targetInbound: "in-proxifier",
    targetOutboundGroup: "Process-Proxy",
    tags: ["ai", "cli", "developer"],
    processMatchers: [
      { processName: "claude" },
      { processName: "codex" },
      { processName: "gemini" },
      { processName: "codebuddy" },
      { processName: "cbc" },
      { processName: "opencode" },
      { processName: "qoder" },
      { processName: "qodercli" },
      { processName: "trae" },
    ],
    notes: [
      "Use this bundle when you want a single catch-all process list for developer AI tools.",
    ],
  },
];

export function listSiteBundles(): readonly SiteBundleSpec[] {
  return siteBundleDefinitions;
}

export function getSiteBundle(id: string): SiteBundleSpec | undefined {
  return siteBundleDefinitions.find((bundle) => bundle.id === id);
}

export function listProcessBundles(): readonly ProcessBundleSpec[] {
  return processBundleDefinitions;
}

export function getProcessBundle(id: string): ProcessBundleSpec | undefined {
  return processBundleDefinitions.find((bundle) => bundle.id === id);
}

export function hasGenericProcessIntent(text: string): boolean {
  const normalized = normalizeText(text);
  return genericProcessIntentAliases.some((alias) => normalized.includes(alias));
}

export function selectSiteBundlesFromText(text: string): readonly SiteBundleSpec[] {
  const normalized = normalizeText(text);
  return siteBundleDefinitions.filter((bundle) =>
    bundle.aliases.some((alias) => normalized.includes(alias)),
  );
}

export function selectProcessBundlesFromText(text: string): readonly ProcessBundleSpec[] {
  const normalized = normalizeText(text);
  const selected = new Set<string>();

  if (hasGenericProcessIntent(normalized)) {
    selected.add("developer-ai-cli");
    selected.add("antigravity");
  }

  for (const bundle of processBundleDefinitions) {
    if (bundle.promptAliases.some((alias) => normalized.includes(alias))) {
      selected.add(bundle.id);
    }
  }

  return processBundleDefinitions.filter((bundle) => selected.has(bundle.id));
}

export function collectSiteBundleDomains(bundles: readonly SiteBundleSpec[]): readonly string[] {
  const domains = new Set<string>();
  for (const bundle of bundles) {
    for (const domain of bundle.domainSuffixes) {
      domains.add(domain);
    }
  }
  return [...domains];
}

function normalizeText(text: string): string {
  return text.toLowerCase();
}
