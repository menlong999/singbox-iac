# sing-box Config Primer

## Top-Level Areas

The generated config will primarily work with:

- `dns`
- `inbounds`
- `outbounds`
- `route`

## Product Model

This project will generate:

- fixed inbound listeners
- dynamic proxy outbounds derived from subscriptions
- dynamic selector and `urltest` groups
- rule sets and route rules assembled with stable precedence

## Compatibility Direction

Target `sing-box` version:

- `1.8.x` or newer, with preference for current rule set and rule action formats

The implementation should prefer:

- external `rule_set` references
- current route actions
- avoiding deprecated legacy structures where newer forms exist

## Key Invariants

- `udp:443` rejection must stay near the top of route processing
- DNS handling must happen before ordinary traffic policy
- `in-proxifier` traffic must have absolute precedence over later domain-based rules
- China direct-routing rules must remain after higher-priority process and AI rules

