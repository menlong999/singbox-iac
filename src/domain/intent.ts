export type IntentVersion = "v1";

export type IntentPlacement = "beforeBuiltins" | "afterBuiltins";

export interface IntentVerifyHint {
  readonly expectedCountry?: readonly string[];
  readonly expectedASN?: readonly string[];
  readonly probeUrls?: readonly string[];
}

export interface IntentSiteMatch {
  readonly inbound?: readonly string[];
  readonly protocol?: string;
  readonly network?: "tcp" | "udp";
  readonly port?: number;
  readonly domain?: readonly string[];
  readonly domainSuffix?: readonly string[];
  readonly ruleSet?: readonly string[];
  readonly category?: readonly string[];
}

export type IntentSiteAction =
  | {
      readonly type: "route";
      readonly outboundGroup: string;
    }
  | {
      readonly type: "reject";
    };

export interface IntentSitePolicy {
  readonly placement: IntentPlacement;
  readonly name?: string;
  readonly match: IntentSiteMatch;
  readonly action: IntentSiteAction;
  readonly verify?: IntentVerifyHint;
}

export interface IntentProcessMatch {
  readonly bundleId?: readonly string[];
  readonly processName?: readonly string[];
}

export interface IntentProcessPolicy {
  readonly name?: string;
  readonly match: IntentProcessMatch;
  readonly inbound: "in-proxifier" | "in-default";
  readonly outboundGroup: string;
  readonly verify?: {
    readonly expectProxyHit?: boolean;
  };
}

export interface IntentLocalOverride {
  readonly hosts?: Record<string, string>;
  readonly dnsPolicy?: readonly {
    readonly domainSuffix: readonly string[];
    readonly server: readonly string[];
  }[];
}

export interface IntentIR {
  readonly version: IntentVersion;
  readonly globals: {
    readonly updateIntervalMinutes?: number;
    readonly preferIPv6?: boolean;
    readonly enableTUN?: boolean;
  };
  readonly sitePolicies: readonly IntentSitePolicy[];
  readonly processPolicies: readonly IntentProcessPolicy[];
  readonly localOverrides: IntentLocalOverride;
}
