# Agent Context

This file is the shared entrypoint for new AI sessions.

Read this first. Then follow the task-specific reading path instead of loading the whole repo.

## What This Project Is

`Singbox IaC` is a developer-focused control plane for `sing-box` on macOS.

It is not:

- a generic GUI proxy client
- a pure subscription converter
- a thin wrapper around raw `sing-box` JSON

It is:

- a policy-first subscription compiler
- a runtime verifier and publisher
- a macOS-oriented desktop/headless control layer

## Core Pipeline

The current architectural spine is:

`subscription / natural language / DSL -> Intent IR -> DNSPlan / VerificationPlan -> compile -> apply transaction -> runtime`

This spine is the main constraint for future changes.

## Current Product Phase

The current priority is to make the existing `system-proxy + process-proxy + real-ip` path stable and trustworthy enough to replace Clash Verge for daily developer use.

That means:

- strengthen runtime stability before widening the feature surface
- keep `TUN + FakeIP` as the next major phase, not the current default
- improve authoring so one-sentence policy changes remain maintainable over time

## Current Runtime Strategy

Today the default desktop runtime is still:

- desktop profile: `system-proxy`
- process-aware path: `in-proxifier`
- DNS mode: `real-ip`

Why:

- it is easier to debug and validate
- it avoids introducing `TUN + FakeIP` complexity too early
- it already covers the user's real current path: browser/system-proxy plus Proxifier for process-aware traffic

The next phase is expected to add a first-class `tun + fake-ip` mode, but only after the current runtime path is stabilized.

## Near-Term Roadmap

The next active change proposals are:

1. `detect-system-proxy-drift`
2. `add-runtime-watchdog-and-proxy-reassert`
3. `recover-from-sleep-and-network-change`
4. `add-network-diagnostics-command`
5. `intent-patch-and-layered-authoring`
6. `smart-site-and-process-bundle-discovery`

These changes have higher priority than wider protocol support or UI work.

## Product Decisions To Preserve

- `sing-box` is still an external binary dependency.
- `singbox-iac` manages config, verification, publish, and runtime orchestration.
- `go / use / update` are the main everyday commands.
- `start / stop / restart / status` are the main runtime commands.
- `use` should evolve toward patch semantics by default, not full replacement semantics.
- Built-in site bundles and process bundles are part of the product, not just docs.

## Progressive Reading Path

### Always Read

1. `/Users/lvyuanfang/Code/SingBoxConfig/README.md`
2. `/Users/lvyuanfang/Code/SingBoxConfig/docs/agent-context.md`
3. `/Users/lvyuanfang/Code/SingBoxConfig/openspec/project.md`

### If You Touch Natural-Language Authoring Or DSL

1. `/Users/lvyuanfang/Code/SingBoxConfig/docs/natural-language-authoring.md`
2. `/Users/lvyuanfang/Code/SingBoxConfig/docs/rules-dsl.md`
3. `/Users/lvyuanfang/Code/SingBoxConfig/src/domain/intent.ts`
4. `/Users/lvyuanfang/Code/SingBoxConfig/src/modules/natural-language/index.ts`
5. `/Users/lvyuanfang/Code/SingBoxConfig/openspec/specs/rule-authoring/spec.md`

### If You Touch Runtime Or Diagnostics

1. `/Users/lvyuanfang/Code/SingBoxConfig/docs/runtime-on-macos.md`
2. `/Users/lvyuanfang/Code/SingBoxConfig/docs/runtime-modes.md`
3. `/Users/lvyuanfang/Code/SingBoxConfig/src/modules/status/index.ts`
4. `/Users/lvyuanfang/Code/SingBoxConfig/src/modules/desktop-runtime/index.ts`
5. `/Users/lvyuanfang/Code/SingBoxConfig/openspec/specs/runtime-manager/spec.md`

### If You Touch Compiler, DNS, Or Verification

1. `/Users/lvyuanfang/Code/SingBoxConfig/docs/sing-box-config-primer.md`
2. `/Users/lvyuanfang/Code/SingBoxConfig/src/domain/dns-plan.ts`
3. `/Users/lvyuanfang/Code/SingBoxConfig/src/domain/verification-plan.ts`
4. `/Users/lvyuanfang/Code/SingBoxConfig/src/modules/compiler/index.ts`
5. `/Users/lvyuanfang/Code/SingBoxConfig/src/modules/verification-plan/index.ts`
6. `/Users/lvyuanfang/Code/SingBoxConfig/openspec/specs/singbox-compiler/spec.md`
7. `/Users/lvyuanfang/Code/SingBoxConfig/openspec/specs/routing-policy/spec.md`

### If You Touch Process-Aware Routing

1. `/Users/lvyuanfang/Code/SingBoxConfig/docs/proxifier-onboarding.md`
2. `/Users/lvyuanfang/Code/SingBoxConfig/docs/antigravity-endpoints.md`
3. `/Users/lvyuanfang/Code/SingBoxConfig/src/modules/proxifier/index.ts`

## OpenSpec Discipline

- Update `openspec/specs/*` when long-lived behavior changes.
- Use `openspec/changes/*` for active work.
- Keep changes small and sequential when touching runtime behavior.
- Prefer adding fixtures and verification plans before widening heuristics.

## Non-Goals For The Current Phase

- do not jump straight to `TUN + FakeIP` implementation
- do not add more protocols just to widen support
- do not build a heavy GUI shell
- do not let natural-language authoring silently guess vague routing intent
