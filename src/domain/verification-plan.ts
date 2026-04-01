export interface VerificationPlan {
  readonly dnsChecks: readonly {
    readonly domain: string;
    readonly expectedMode: "fake-ip" | "real-ip";
    readonly expectedResolver?: string;
  }[];
  readonly routeChecks: readonly {
    readonly id: string;
    readonly name: string;
    readonly target: string;
    readonly inbound: "in-mixed" | "in-proxifier";
    readonly expectedOutboundGroup: string;
    readonly expectedRuleHint?: string;
  }[];
  readonly egressChecks: readonly {
    readonly id: string;
    readonly target: string;
    readonly inbound: "in-mixed" | "in-proxifier";
    readonly expectedOutboundGroup: string;
    readonly expectedCountry?: readonly string[];
    readonly expectedASN?: readonly string[];
  }[];
  readonly appChecks: readonly {
    readonly id: string;
    readonly app: string;
    readonly expectedInbound: "in-proxifier" | "in-default";
    readonly expectedOutboundGroup: string;
  }[];
  readonly protocolChecks: readonly {
    readonly id: string;
    readonly target: string;
    readonly expectTCPOnly?: boolean;
  }[];
}
