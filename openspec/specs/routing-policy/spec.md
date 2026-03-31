# Routing Policy

## Goal

Define stable route behavior independent of provider subscription shape.

## Required Priority

The compiler must preserve these priorities from top to bottom:

1. Reject `udp:443` traffic to suppress QUIC when required.
2. Handle DNS traffic before general routing.
3. Give `in-proxifier` traffic absolute precedence through `Process-Proxy`.
4. Route dedicated Google Stitch traffic to `Stitch-Out`.
5. Route explicit OpenAI and ChatGPT first-party domains to `AI-Out`.
6. Route AI traffic via dedicated rule sets to `AI-Out`.
7. Route developer and common services via dedicated rule sets to `Dev-Common-Out`.
8. Route China traffic to `direct`.

## Requirements

- User-defined rules must not silently override protected system invariants.
- Policy insertion points for user rules must be explicit.
- The supported insertion points are `beforeBuiltins` and `afterBuiltins`.
- Rule-set references must remain externally configurable.
- Dedicated domain rules must be able to override broader service rule sets when needed.
- The generated route config must define a `default_domain_resolver` compatible with the emitted DNS servers.
- Policy groups must support explicit default targets so user journeys can pin categories such as `Process-Proxy` or `Stitch-Out` to a deterministic selector or leaf node.
- Policy groups must support node-tag pattern matching for cases where a fixed leaf node should be selected from a region, such as an `OnlyAI`-suffixed US node.
- The default path for AI and developer traffic must remain separately configurable from the global fallback path.
