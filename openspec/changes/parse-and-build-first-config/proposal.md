# Change Proposal: parse-and-build-first-config

## Summary

Deliver the first self-hostable MVP by implementing a vertical slice that can:

- fetch or read a subscription input
- parse Trojan share links
- compile a minimal but usable `sing-box` config
- write the generated config to disk

## Why

The full phased roadmap is correct for long-term architecture, but it is too horizontal for immediate self-use. The project needs one narrow path that becomes usable as early as possible.

This change prioritizes:

- getting a real config generated quickly
- proving the parser and compiler boundaries with real data
- enabling local dogfooding before runtime automation is complete

## Scope

This MVP change includes:

- Base64 line decoding
- Trojan URI parsing
- minimal outbound generation
- minimal static inbound and route assembly
- a `build` command that writes a config artifact

## Non-Goals

- advanced dynamic region grouping
- automatic reload and scheduling
- full rule DSL support
- natural-language rule authoring
- multi-protocol support beyond Trojan

## Exit Criteria

This change is complete when a user can provide a subscription URL or equivalent input and obtain a usable `config.json` for local `sing-box` testing.

