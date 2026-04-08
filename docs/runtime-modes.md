# Runtime Modes

This document explains the internal runtime planning model used by `singbox-iac`.

Users do not need to choose these modes manually in the current phase. The CLI infers them from the onboarding path and prompt shape.

## Why Runtime Modes Exist

The project already supports several operational shapes:

- browser-oriented proxy usage
- process-aware proxy usage with Proxifier
- headless recurring update/publish flows
- an early desktop `tun` profile

Without an explicit planning layer, defaults become hard to reason about. `RuntimeMode` keeps those defaults consistent.

## Current Runtime Modes

### `browser-proxy`

Use this when the main path is browser or normal system-proxy traffic.

Typical defaults:

- desktop runtime profile: `system-proxy`
- visible verification: browser-oriented sites
- listener focus: `in-mixed`

### `process-proxy`

Use this when process-aware routing is a first-class requirement.

Typical defaults:

- desktop runtime profile: `system-proxy`
- visible verification: `in-proxifier` plus browser sanity checks
- listener focus: `in-proxifier` and `in-mixed`
- Proxifier bundle hints are surfaced

This is the current daily-driver path for:

- Antigravity
- developer AI CLIs
- desktop apps that do not reliably honor macOS system proxy settings

### `headless-daemon`

Use this when the main need is unattended update / verify / publish behavior.

Typical defaults:

- no user-facing runtime launch is required
- schedule and status matter more than browser-driven validation

## Desktop Runtime Profiles

`RuntimeMode` and desktop runtime profile are related but not identical.

### `system-proxy`

The CLI emits a `mixed` inbound and lets `sing-box` set and clean macOS system proxy automatically.

This is the current default desktop profile because it is simpler to debug and is good enough for the current stabilization phase.

### `tun`

The CLI can also emit a `tun` inbound with `auto_route`.

This is not the current default. It exists as an explicit profile because it is part of the long-term plan, but the project is still prioritizing stability in the current `system-proxy + process-proxy + real-ip` path before making `tun + fake-ip` a primary workflow.

## Current Product Direction

Short term:

- stabilize `system-proxy`
- improve status, diagnostics, and recovery
- improve authoring semantics and bundle intelligence

Next major phase:

- add first-class `tun + fake-ip`
- validate process-aware routing under TUN
- reduce dependence on Proxifier for advanced developer workflows
