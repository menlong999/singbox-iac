# Positioning

## One-Line Summary

`Sing-box IaC Builder` is a policy-first CLI that compiles subscriptions into safe, headless `sing-box` infrastructure for macOS.

## Problem Statement

Existing workflows usually optimize for importing subscriptions into a GUI client. They do not optimize for:

- deterministic route priority
- process-aware routing via `Proxifier`
- multiple listeners with stable semantics
- headless runtime management
- low resource usage
- safe rollout and validation

## Strategic Difference

This project separates three concerns that are often mixed together:

1. provider input
2. local policy
3. runtime application

Provider subscriptions are treated as untrusted upstream data. Local policy is declared separately and compiled with stable precedence. Runtime application is validated before live deployment.

## Open Source Position

This project should be published as:

- a `sing-box` compiler, not a generic converter
- a macOS-first headless runtime tool, not a GUI replacement
- a policy authoring system, not only a template pack

## Target Users

- advanced macOS users who already run `sing-box`
- users migrating away from Clash Verge or similar GUI clients
- users relying on `Proxifier`, AI applications, or mixed app-specific routing
- users who want a low-overhead headless runtime

