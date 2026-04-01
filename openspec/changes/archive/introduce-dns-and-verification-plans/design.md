# Design

## DNSPlan

Initial DNSPlan shape:

```ts
type DNSPlan = {
  mode: "real-ip";
  defaultResolvers: string[];
  directResolvers: string[];
  proxyResolvers: string[];
  fallbackResolvers: string[];
  nameserverPolicy: Array<{
    match: string[];
    resolvers: string[];
  }>;
  fakeIpFilter: string[];
  localHosts?: Record<string, string>;
};
```

The first implementation stays on `real-ip`, but makes server selection and nameserver policy
explicit and testable.

## VerificationPlan

Initial VerificationPlan shape:

```ts
type VerificationPlan = {
  dnsChecks: Array<{ domain: string; expectedMode: "real-ip" | "fake-ip" }>;
  routeChecks: Array<{
    id: string;
    target: string;
    inbound: "in-mixed" | "in-proxifier";
    expectedOutboundGroup: string;
    expectedRuleHint?: string;
  }>;
  egressChecks: Array<{
    id: string;
    target: string;
    expectedCountry?: string[];
    expectedASN?: string[];
  }>;
  appChecks: Array<{
    id: string;
    app: string;
    expectedInbound: "in-proxifier" | "in-default";
    expectedOutboundGroup: string;
  }>;
  protocolChecks: Array<{
    id: string;
    target: string;
    expectTCPOnly?: boolean;
  }>;
};
```

## CLI shape

`verify` will support sub-modes:

- `verify`
- `verify route`
- `verify egress`
- `verify dns`
- `verify app`
- `verify protocol`

The top-level `verify` remains the umbrella command and runs the full matrix.

