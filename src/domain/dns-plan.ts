export interface DnsPlanServer {
  readonly type: "local" | "tcp";
  readonly tag: string;
  readonly server?: string;
  readonly serverPort?: number;
  readonly preferGo?: boolean;
}

export interface DnsPlanRule {
  readonly match: {
    readonly domain?: readonly string[];
    readonly domainSuffix?: readonly string[];
    readonly ruleSet?: readonly string[];
  };
  readonly resolvers: readonly string[];
}

export interface DNSPlan {
  readonly mode: "real-ip" | "fake-ip";
  readonly defaultResolvers: readonly string[];
  readonly directResolvers: readonly string[];
  readonly proxyResolvers: readonly string[];
  readonly fallbackResolvers: readonly string[];
  readonly servers: readonly DnsPlanServer[];
  readonly nameserverPolicy: readonly DnsPlanRule[];
  readonly fakeIpFilter: readonly string[];
  readonly localHosts?: Record<string, string>;
  readonly strategy: "prefer_ipv4" | "prefer_ipv6";
}
