# Proposal: Add Local AI CLI Authoring Providers

## Why

The natural-language front door already exists, but developers often have local AI CLIs installed and authenticated already. For this project, forcing API keys or cloud-provider wiring would be too heavy.

We need a way to:

- keep deterministic authoring as the safe default
- optionally probe a local AI CLI
- fall back cleanly when the local CLI is unavailable, hangs, or returns unusable output
- expose this behavior through config, CLI, and doctor output

## What Changes

- Add an authoring-provider layer with:
  - `deterministic`
  - `auto`
  - `claude`
  - `exec`
- Detect local AI CLIs in `doctor`.
- Allow `author` to select a provider and to configure exec-provider command arguments.
- Add config support for `authoring.provider`, `authoring.timeoutMs`, and optional exec configuration.
- Add a real smoke flow proving that `auto` can fall back from a local AI CLI to deterministic authoring without breaking build output.

## Impact

- Developer users can reuse local AI CLI tooling when they want it.
- The project remains usable without any external model setup.
- The authoring layer stays bounded to DSL-plan generation and never bypasses compiler validation.
