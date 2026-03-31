import type { UserRouteRule } from "../user-rules/index.js";

export interface RuleTemplate {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly beforeBuiltins: readonly UserRouteRule[];
  readonly afterBuiltins: readonly UserRouteRule[];
  readonly tags: readonly string[];
}

const templateCatalog: readonly RuleTemplate[] = [
  {
    id: "developer-ai-sites",
    title: "Developer AI Sites",
    summary: "Route common third-party AI sites like OpenRouter and Perplexity to AI-Out.",
    tags: ["developer", "ai"],
    beforeBuiltins: [
      {
        name: "OpenRouter uses the AI selector",
        domainSuffix: ["openrouter.ai"],
        route: "AI-Out",
      },
      {
        name: "Perplexity uses the AI selector",
        domainSuffix: ["perplexity.ai"],
        route: "AI-Out",
      },
    ],
    afterBuiltins: [],
  },
  {
    id: "developer-common-sites",
    title: "Developer Common Sites",
    summary:
      "Route common third-party developer sites like GitLab, npm, Vercel, Docker Hub, and Stack Overflow to Dev-Common-Out.",
    tags: ["developer", "tools"],
    beforeBuiltins: [
      {
        name: "Common third-party developer sites use Dev-Common-Out",
        domainSuffix: [
          "gitlab.com",
          "npmjs.com",
          "registry.npmjs.org",
          "vercel.com",
          "cloudflare.com",
          "docker.com",
          "hub.docker.com",
          "stackoverflow.com",
          "huggingface.co",
        ],
        route: "Dev-Common-Out",
      },
    ],
    afterBuiltins: [],
  },
  {
    id: "video-us",
    title: "Video Streaming via US",
    summary: "Route popular US-oriented video sites to the US selector.",
    tags: ["video", "streaming", "us"],
    beforeBuiltins: [
      {
        name: "US video streaming uses US",
        domainSuffix: [
          "youtube.com",
          "youtu.be",
          "netflix.com",
          "nflxvideo.net",
          "primevideo.com",
          "amazonvideo.com",
          "disneyplus.com",
          "disney-plus.net",
          "tv.apple.com",
          "hulu.com",
          "max.com",
        ],
        route: "US",
      },
    ],
    afterBuiltins: [],
  },
  {
    id: "video-hk",
    title: "Video Streaming via HK",
    summary: "Route popular international video sites to the HK selector.",
    tags: ["video", "streaming", "hk"],
    beforeBuiltins: [
      {
        name: "International video streaming uses HK",
        domainSuffix: [
          "youtube.com",
          "youtu.be",
          "netflix.com",
          "nflxvideo.net",
          "primevideo.com",
          "amazonvideo.com",
          "disneyplus.com",
          "disney-plus.net",
          "tv.apple.com",
          "hulu.com",
          "max.com",
          "twitch.tv",
        ],
        route: "HK",
      },
    ],
    afterBuiltins: [],
  },
  {
    id: "video-sg",
    title: "Video Streaming via SG",
    summary: "Route popular international video sites to the SG selector.",
    tags: ["video", "streaming", "sg"],
    beforeBuiltins: [
      {
        name: "International video streaming uses SG",
        domainSuffix: [
          "youtube.com",
          "youtu.be",
          "netflix.com",
          "nflxvideo.net",
          "primevideo.com",
          "amazonvideo.com",
          "disneyplus.com",
          "disney-plus.net",
          "tv.apple.com",
          "hulu.com",
          "max.com",
          "twitch.tv",
        ],
        route: "SG",
      },
    ],
    afterBuiltins: [],
  },
  {
    id: "video-jp",
    title: "Video Streaming via JP",
    summary: "Route Japan-oriented video services to the JP selector.",
    tags: ["video", "streaming", "jp"],
    beforeBuiltins: [
      {
        name: "JP video streaming uses JP",
        domainSuffix: ["abema.tv", "niconico.jp", "dmm.com", "lemino.docomo.ne.jp"],
        route: "JP",
      },
    ],
    afterBuiltins: [],
  },
  {
    id: "cn-video-direct",
    title: "China Video Direct",
    summary: "Keep common mainland video sites on direct routing.",
    tags: ["video", "cn", "direct"],
    beforeBuiltins: [],
    afterBuiltins: [
      {
        name: "Mainland video sites stay direct",
        domainSuffix: [
          "bilibili.com",
          "bilibili.tv",
          "iqiyi.com",
          "iq.com",
          "youku.com",
          "mgtv.com",
        ],
        route: "direct",
      },
    ],
  },
];

export function listRuleTemplates(): readonly RuleTemplate[] {
  return templateCatalog;
}

export function getRuleTemplate(id: string): RuleTemplate | undefined {
  return templateCatalog.find((template) => template.id === id);
}

export function mergeRuleTemplates(templateIds: readonly string[]): {
  readonly beforeBuiltins: readonly UserRouteRule[];
  readonly afterBuiltins: readonly UserRouteRule[];
} {
  const resolved = templateIds.map((id) => {
    const template = getRuleTemplate(id);
    if (!template) {
      throw new Error(`Unknown rule template "${id}".`);
    }
    return template;
  });

  return {
    beforeBuiltins: dedupeRules(resolved.flatMap((template) => template.beforeBuiltins)),
    afterBuiltins: dedupeRules(resolved.flatMap((template) => template.afterBuiltins)),
  };
}

function dedupeRules(rules: readonly UserRouteRule[]): readonly UserRouteRule[] {
  const byKey = new Map<string, UserRouteRule>();
  for (const rule of rules) {
    byKey.set(stableRuleKey(rule), rule);
  }
  return [...byKey.values()];
}

function stableRuleKey(rule: UserRouteRule): string {
  return JSON.stringify({
    inbound: rule.inbound ?? [],
    protocol: rule.protocol ?? null,
    network: rule.network ?? null,
    port: rule.port ?? null,
    domain: rule.domain ?? [],
    domainSuffix: rule.domainSuffix ?? [],
    ruleSet: rule.ruleSet ?? [],
    route: rule.route ?? null,
    action: rule.action ?? null,
  });
}
