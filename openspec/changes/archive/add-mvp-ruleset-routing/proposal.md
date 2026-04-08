# Change Proposal: add-mvp-ruleset-routing

## Summary

Extend the MVP config compiler with practical ruleset-based routing for:

- AI-dedicated traffic
- China direct traffic
- developer and common services
- a dedicated Google Stitch route

## Why

The first MVP can already generate a valid config, but it still routes most traffic through the global fallback. For immediate daily use, the generated config needs a few higher-value traffic classes wired in.

## Scope

- download and reference local `.srs` rule sets
- generate additional policy groups for AI, dev/common services, and Stitch
- add route rules in stable priority order
- keep the current runtime-safe staged validation flow

## Non-Goals

- arbitrary user-authored routing DSL
- automatic ruleset updates
- full production DNS strategy

