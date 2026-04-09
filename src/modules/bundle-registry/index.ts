export interface SiteBundleSpec {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly preferredRuleSetTags?: readonly string[];
  readonly fallbackDomains?: readonly string[];
  readonly fallbackDomainSuffixes?: readonly string[];
  readonly verificationUrls: readonly string[];
  readonly tags: readonly string[];
  readonly notes?: readonly string[];
}

export interface ResolvedSiteBundleMatchers {
  readonly bundleId: string;
  readonly bundleName: string;
  readonly ruleSet?: readonly string[];
  readonly domain?: readonly string[];
  readonly domainSuffix?: readonly string[];
  readonly usedFallback: boolean;
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
    fallbackDomainSuffixes: ["notebooklm.google.com"],
    verificationUrls: ["https://notebooklm.google.com/favicon.ico"],
    tags: ["ai", "google"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    aliases: ["openrouter"],
    fallbackDomainSuffixes: ["openrouter.ai"],
    verificationUrls: ["https://openrouter.ai/favicon.ico"],
    tags: ["ai"],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    aliases: ["perplexity"],
    preferredRuleSetTags: ["geosite-perplexity"],
    fallbackDomainSuffixes: ["perplexity.ai", "perplexity.com", "pplx.ai"],
    verificationUrls: ["https://www.perplexity.ai/favicon.ico"],
    tags: ["ai"],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    aliases: ["chatgpt"],
    preferredRuleSetTags: ["geosite-openai"],
    fallbackDomainSuffixes: ["chatgpt.com", "oaistatic.com", "oaiusercontent.com"],
    fallbackDomains: ["chat.openai.com.cdn.cloudflare.net", "api.statsig.com"],
    verificationUrls: ["https://chatgpt.com/favicon.ico"],
    tags: ["ai", "openai"],
  },
  {
    id: "openai",
    name: "OpenAI",
    aliases: ["openai", "openai api"],
    preferredRuleSetTags: ["geosite-openai"],
    fallbackDomainSuffixes: [
      "openai.com",
      "oaistatic.com",
      "oaiusercontent.com",
      "openaiapi-site.azureedge.net",
      "openaicom.imgix.net",
    ],
    fallbackDomains: [
      "openai-api.arkoselabs.com",
      "production-openaicom-storage.azureedge.net",
      "openaicomproductionae4b.blob.core.windows.net",
    ],
    verificationUrls: ["https://openai.com/favicon.ico"],
    tags: ["ai"],
  },
  {
    id: "gemini",
    name: "Gemini",
    aliases: ["gemini", "google gemini"],
    preferredRuleSetTags: ["geosite-google-gemini"],
    fallbackDomainSuffixes: [
      "gemini.google.com",
      "generativelanguage.googleapis.com",
      "proactivebackend-pa.googleapis.com",
      "aisandbox-pa.googleapis.com",
      "robinfrontend-pa.googleapis.com",
      "alkalimakersuite-pa.clients6.google.com",
      "alkalicore-pa.clients6.google.com",
      "waa-pa.clients6.google.com",
    ],
    fallbackDomains: ["ai.google.dev", "makersuite.google.com", "aistudio.google.com"],
    verificationUrls: ["https://gemini.google.com/favicon.ico"],
    tags: ["ai", "google"],
  },
  {
    id: "anthropic",
    name: "Anthropic / Claude",
    aliases: ["anthropic", "claude", "claude ai"],
    preferredRuleSetTags: ["geosite-anthropic"],
    fallbackDomainSuffixes: ["anthropic.com", "claude.ai"],
    verificationUrls: ["https://claude.ai/favicon.ico"],
    tags: ["ai"],
  },
  {
    id: "github",
    name: "GitHub",
    aliases: ["github", "github copilot"],
    preferredRuleSetTags: ["geosite-github", "geosite-github-copilot"],
    fallbackDomainSuffixes: ["github.com", "githubusercontent.com"],
    verificationUrls: ["https://github.com/favicon.ico"],
    tags: ["developer"],
  },
  {
    id: "google-services",
    name: "Google Services",
    aliases: ["google 服务", "google services"],
    preferredRuleSetTags: ["geosite-google"],
    fallbackDomainSuffixes: [
      "google.com",
      "googleapis.com",
      "gstatic.com",
      "googlevideo.com",
      "1e100.net",
      "appspot.com",
      "gcr.io",
      "gvt0.com",
      "gvt1.com",
    ],
    verificationUrls: ["https://www.google.com/favicon.ico"],
    tags: ["google", "services"],
  },
  {
    id: "apple-services",
    name: "Apple Services",
    aliases: ["apple 服务", "apple services", "icloud"],
    preferredRuleSetTags: ["geosite-apple"],
    fallbackDomainSuffixes: ["apple.com", "icloud.com", "mzstatic.com", "apple-dns.net"],
    fallbackDomains: ["apple-relay.apple.com"],
    verificationUrls: ["https://www.icloud.com/favicon.ico"],
    tags: ["apple", "services"],
  },
  {
    id: "google-stitch",
    name: "Google Stitch",
    aliases: ["google stitch", "stitch"],
    fallbackDomainSuffixes: ["stitch.withgoogle.com"],
    verificationUrls: ["https://stitch.withgoogle.com/favicon.ico"],
    tags: ["google", "developer"],
  },
  {
    id: "google-tv",
    name: "Google TV",
    aliases: ["google tv"],
    fallbackDomains: ["tv.youtube.com"],
    verificationUrls: ["https://tv.youtube.com/favicon.ico"],
    tags: ["video", "google"],
  },
  {
    id: "youtube",
    name: "YouTube",
    aliases: ["youtube"],
    preferredRuleSetTags: ["geosite-youtube"],
    fallbackDomainSuffixes: ["youtube.com", "youtu.be", "ytimg.com"],
    verificationUrls: ["https://www.youtube.com/favicon.ico"],
    tags: ["video"],
  },
  {
    id: "netflix",
    name: "Netflix",
    aliases: ["netflix"],
    preferredRuleSetTags: ["geosite-netflix"],
    fallbackDomainSuffixes: [
      "netflix.com",
      "netflix.net",
      "nflxext.com",
      "nflximg.com",
      "nflximg.net",
      "nflxso.net",
      "nflxvideo.net",
      "fast.com",
    ],
    verificationUrls: ["https://www.netflix.com/favicon.ico"],
    tags: ["video"],
  },
  {
    id: "amazon-prime",
    name: "Amazon Prime Video",
    aliases: ["amazon prime", "prime video", "primevideo", "amazon video"],
    preferredRuleSetTags: ["geosite-primevideo"],
    fallbackDomainSuffixes: ["primevideo.com", "amazonvideo.com"],
    verificationUrls: ["https://www.primevideo.com/favicon.ico"],
    tags: ["video"],
  },
  {
    id: "disney-plus",
    name: "Disney+",
    aliases: ["disney+", "disney plus", "disneyplus"],
    preferredRuleSetTags: ["geosite-disney"],
    fallbackDomainSuffixes: [
      "disneyplus.com",
      "disney-plus.net",
      "disneystreaming.com",
      "bamgrid.com",
      "dssott.com",
    ],
    fallbackDomains: ["cdn.registerdisney.go.com"],
    verificationUrls: ["https://www.disneyplus.com/favicon.ico"],
    tags: ["video"],
  },
  {
    id: "apple-tv",
    name: "Apple TV",
    aliases: ["apple tv"],
    preferredRuleSetTags: ["geosite-apple-tvplus"],
    fallbackDomainSuffixes: ["tv.apple.com"],
    verificationUrls: ["https://tv.apple.com/favicon.ico"],
    tags: ["video", "apple"],
  },
  {
    id: "bilibili",
    name: "Bilibili",
    aliases: ["bilibili", "b站"],
    preferredRuleSetTags: ["geosite-bilibili"],
    fallbackDomainSuffixes: ["bilibili.com", "bilibili.tv"],
    verificationUrls: ["https://www.bilibili.com/favicon.ico"],
    tags: ["video", "cn"],
  },
  {
    id: "iqiyi",
    name: "iQIYI",
    aliases: ["iqiyi", "爱奇艺"],
    preferredRuleSetTags: ["geosite-iqiyi"],
    fallbackDomainSuffixes: ["iqiyi.com", "iq.com"],
    verificationUrls: ["https://www.iqiyi.com/favicon.ico"],
    tags: ["video", "cn"],
  },
  {
    id: "youku",
    name: "Youku",
    aliases: ["youku", "优酷"],
    preferredRuleSetTags: ["geosite-youku"],
    fallbackDomainSuffixes: ["youku.com"],
    verificationUrls: ["https://www.youku.com/favicon.ico"],
    tags: ["video", "cn"],
  },
  {
    id: "mgtv",
    name: "MGTV",
    aliases: ["mgtv", "芒果tv", "芒果"],
    fallbackDomainSuffixes: ["mgtv.com"],
    verificationUrls: ["https://www.mgtv.com/favicon.ico"],
    tags: ["video", "cn"],
  },
  {
    id: "line",
    name: "LINE",
    aliases: ["line"],
    preferredRuleSetTags: ["geosite-line"],
    fallbackDomainSuffixes: [
      "line.me",
      "line.naver.jp",
      "line-apps.com",
      "line-cdn.net",
      "line-scdn.net",
      "lin.ee",
    ],
    verificationUrls: ["https://line.me/favicon.ico"],
    tags: ["social"],
  },
  {
    id: "bbc",
    name: "BBC",
    aliases: ["bbc"],
    preferredRuleSetTags: ["geosite-bbc"],
    fallbackDomainSuffixes: ["bbc.co", "bbc.com"],
    verificationUrls: ["https://www.bbc.com/favicon.ico"],
    tags: ["media"],
  },
  {
    id: "microsoft-services",
    name: "Microsoft Services",
    aliases: ["microsoft", "copilot microsoft", "bing copilot"],
    preferredRuleSetTags: ["geosite-microsoft"],
    fallbackDomainSuffixes: [
      "bing.com",
      "bing.net",
      "live.com",
      "live.net",
      "msn.com",
      "office.com",
      "office.net",
      "outlook.com",
      "office365.com",
      "onedrive.com",
      "onenote.com",
      "hotmail.com",
      "msedge.net",
    ],
    fallbackDomains: [
      "api.msn.com",
      "assets.msn.com",
      "content.office.net",
      "copilot.microsoft.com",
    ],
    verificationUrls: ["https://www.bing.com/favicon.ico"],
    tags: ["microsoft", "services"],
  },
  {
    id: "xai",
    name: "xAI / Grok",
    aliases: ["xai", "grok"],
    preferredRuleSetTags: ["geosite-xai"],
    fallbackDomainSuffixes: ["x.ai", "grok.com"],
    verificationUrls: ["https://x.ai/favicon.ico"],
    tags: ["ai"],
  },
  {
    id: "leetcode",
    name: "LeetCode",
    aliases: ["leetcode", "力扣"],
    fallbackDomainSuffixes: ["leetcode.com"],
    verificationUrls: ["https://leetcode.com/favicon.ico"],
    tags: ["developer", "learning"],
  },
  {
    id: "tradingview",
    name: "TradingView",
    aliases: ["tradingview", "trading view"],
    fallbackDomainSuffixes: ["tradingview.com"],
    verificationUrls: ["https://www.tradingview.com/favicon.ico"],
    tags: ["finance", "tools"],
  },
  {
    id: "typingmind",
    name: "TypingMind",
    aliases: ["typingmind", "typing mind"],
    fallbackDomainSuffixes: ["typingmind.com"],
    verificationUrls: ["https://www.typingmind.com/favicon.ico"],
    tags: ["ai", "tools"],
  },
  {
    id: "roam-research",
    name: "Roam Research",
    aliases: ["roam research", "roamresearch"],
    fallbackDomainSuffixes: ["roamresearch.com"],
    verificationUrls: ["https://roamresearch.com/favicon.ico"],
    tags: ["notes", "tools"],
  },
  {
    id: "todoist",
    name: "Todoist",
    aliases: ["todoist"],
    fallbackDomainSuffixes: ["todoist.com"],
    verificationUrls: ["https://todoist.com/favicon.ico"],
    tags: ["productivity", "tools"],
  },
  {
    id: "ifttt",
    name: "IFTTT",
    aliases: ["ifttt"],
    fallbackDomainSuffixes: ["ifttt.com", "ift.tt"],
    verificationUrls: ["https://ifttt.com/favicon.ico"],
    tags: ["automation", "tools"],
  },
  {
    id: "humble-bundle",
    name: "Humble Bundle",
    aliases: ["humble bundle", "humblebundle"],
    fallbackDomainSuffixes: ["humblebundle.com"],
    verificationUrls: ["https://www.humblebundle.com/favicon.ico"],
    tags: ["gaming", "store"],
  },
  {
    id: "fanatical",
    name: "Fanatical",
    aliases: ["fanatical"],
    fallbackDomainSuffixes: ["fanatical.com"],
    verificationUrls: ["https://www.fanatical.com/favicon.ico"],
    tags: ["gaming", "store"],
  },
  {
    id: "grindr",
    name: "Grindr",
    aliases: ["grindr"],
    fallbackDomainSuffixes: ["grindr.com", "grindr.mobi"],
    verificationUrls: ["https://www.grindr.com/favicon.ico"],
    tags: ["social"],
  },
  {
    id: "behance",
    name: "Behance",
    aliases: ["behance"],
    fallbackDomainSuffixes: ["behance.net"],
    verificationUrls: ["https://www.behance.net/favicon.ico"],
    tags: ["design", "community"],
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

export function listBuiltInPreferredSiteRuleSetTags(): readonly string[] {
  const tags = new Set<string>();
  for (const bundle of siteBundleDefinitions) {
    for (const tag of bundle.preferredRuleSetTags ?? []) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
}

export function resolveSiteBundleMatchers(
  bundles: readonly SiteBundleSpec[],
  activeRuleSetTags: ReadonlySet<string>,
): readonly ResolvedSiteBundleMatchers[] {
  const resolved: ResolvedSiteBundleMatchers[] = [];

  for (const bundle of bundles) {
    const preferredRuleSets = (bundle.preferredRuleSetTags ?? []).filter((tag) =>
      activeRuleSetTags.has(tag),
    );

    if (preferredRuleSets.length > 0) {
      resolved.push({
        bundleId: bundle.id,
        bundleName: bundle.name,
        ruleSet: preferredRuleSets,
        usedFallback: false,
      });
      continue;
    }

    if (
      (!bundle.fallbackDomains || bundle.fallbackDomains.length === 0) &&
      (!bundle.fallbackDomainSuffixes || bundle.fallbackDomainSuffixes.length === 0)
    ) {
      continue;
    }

    resolved.push({
      bundleId: bundle.id,
      bundleName: bundle.name,
      ...(bundle.fallbackDomains && bundle.fallbackDomains.length > 0
        ? { domain: [...bundle.fallbackDomains] }
        : {}),
      ...(bundle.fallbackDomainSuffixes && bundle.fallbackDomainSuffixes.length > 0
        ? { domainSuffix: [...bundle.fallbackDomainSuffixes] }
        : {}),
      usedFallback: true,
    });
  }

  return resolved;
}

export function collectSiteBundleFallbackHosts(
  bundles: readonly SiteBundleSpec[],
): readonly string[] {
  const domains = new Set<string>();
  for (const bundle of bundles) {
    for (const domain of bundle.fallbackDomains ?? []) {
      domains.add(domain);
    }
    for (const domain of bundle.fallbackDomainSuffixes ?? []) {
      domains.add(domain);
    }
  }
  return [...domains];
}

export function collectSiteBundleVerificationHosts(
  bundles: readonly SiteBundleSpec[],
): readonly string[] {
  const hosts = new Set<string>();
  for (const bundle of bundles) {
    for (const url of bundle.verificationUrls) {
      try {
        hosts.add(new URL(url).hostname.toLowerCase());
      } catch {}
    }
  }
  return [...hosts];
}

function normalizeText(text: string): string {
  return text.toLowerCase();
}
