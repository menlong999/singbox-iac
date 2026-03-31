# Project: Sing-box IaC Builder

## Mission

Build a Node.js and TypeScript CLI that converts fragile proxy subscriptions into deterministic, verifiable, and headless `sing-box` infrastructure for macOS.

## Product Principles

- Policy-first: subscriptions provide nodes, not routing policy.
- Deterministic: route ordering and compiler behavior must be stable and testable.
- Defensive: invalid upstream data must not crash the whole build.
- Safe rollout: no unchecked config may replace the live config.
- Headless-first: optimize for low-overhead CLI usage with `sing-box` running independently.

## Target Environment

- Node.js `>=20.19.0`
- macOS is the primary supported platform
- `sing-box` `1.8.x` or newer

## Architecture

The system is composed of:

1. `Fetcher`
2. `Parser`
3. `Compiler`
4. `Manager`
5. `CLI`
6. `Scheduler`

## Implementation Constraints

- TypeScript strict mode is required.
- Single-node parse failures must be logged and skipped, not crash the whole pipeline.
- Compiler route priority must be explicit and covered by tests.
- Use current `sing-box` rule-set and route-action style where applicable, avoiding deprecated legacy structures.
- User customization must converge on a validated DSL before touching generated config.

## Output Model

Expected runtime artifact flow:

1. provider subscription
2. normalized intermediate model
3. compiled staging `config.json`
4. validation via `sing-box check`
5. atomic publish to live config
6. runtime reload

## Quality Gates

- parser behavior must be fixture-tested
- compiler output must be snapshot-tested
- route priority invariants must be tested
- critical user journeys must be verifiable end-to-end with generated configs, real `sing-box`, and real client traffic
- runtime manager must not publish unchecked configs

## Development Method

OpenSpec stores the spec baseline. Superpowers is used as the execution discipline:

- brainstorm before non-trivial changes
- write a plan for each change
- implement in small batches
- verify after each phase

When early dogfooding matters more than strict horizontal phase order, prefer a vertical MVP slice that still respects the same capability boundaries and invariants.
