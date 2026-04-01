# Design

## IntentIR

`IntentIR` is the internal policy representation used by compiler, verification, and publish flows.

Initial shape:

```ts
type IntentIR = {
  version: "v1";
  globals: {
    updateIntervalMinutes?: number;
    preferIPv6?: boolean;
    enableTUN?: boolean;
  };
  sitePolicies: Array<{
    placement: "beforeBuiltins" | "afterBuiltins";
    name?: string;
    match: {
      inbound?: string[];
      protocol?: string;
      network?: "tcp" | "udp";
      port?: number;
      domain?: string[];
      domainSuffix?: string[];
      ruleSet?: string[];
      category?: string[];
    };
    action: {
      type: "route" | "reject";
      outboundGroup?: string;
    };
    verify?: {
      expectedCountry?: string[];
      expectedASN?: string[];
      probeUrls?: string[];
    };
  }>;
  processPolicies: Array<{
    name?: string;
    match: {
      bundleId?: string[];
      processName?: string[];
    };
    inbound: "in-proxifier" | "in-default";
    outboundGroup: string;
    verify?: {
      expectProxyHit?: boolean;
    };
  }>;
  localOverrides: {
    hosts?: Record<string, string>;
    dnsPolicy?: Array<{
      domainSuffix: string[];
      server: string[];
    }>;
  };
};
```

## Sources

- DSL rules load into `IntentIR.sitePolicies`
- natural-language authoring produces `IntentIR` directly
- builder config group overrides remain in builder config for now, but prompt-derived group defaults
  are mirrored into `IntentIR.globals`-adjacent authoring data and still written back to config
  for backward compatibility

## Compiler integration

- `compileConfig` stops accepting raw DSL rules
- `buildConfigArtifact` resolves an effective `IntentIR`
- compiler only sees `nodes + builder config + IntentIR`

## Migration strategy

- keep the existing DSL file path and schema
- add an `intent` module with merge and normalize helpers
- keep existing CLI behavior stable while switching internal flow to IR

