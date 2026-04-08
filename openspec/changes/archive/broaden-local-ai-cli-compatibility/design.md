# Design

## Core Decision

Treat local AI CLI support as a compatibility layer, not a provider explosion.

The project already has:

- `deterministic`
- `auto`
- `claude`
- `exec`

This change keeps that surface area. Instead of introducing many new provider enums, it makes `exec` rich enough to cover most developer tooling:

- prompt placeholder
- full portable prompt placeholder
- schema placeholder
- context placeholder
- schema temp file
- output temp file
- JSON extraction from noisy text

## Tool Classification

Doctor should communicate that local tools fall into one of three buckets:

- `builtin`
  Verified first-class provider support
- `exec`
  Expected to work through the generic exec adapter
- `tooling-only`
  Present locally but not suitable as a non-interactive authoring backend

This lets the project acknowledge tools like `gemini`, `codebuddy`, `codex`, `opencode`, and `trae` without pretending every one of them deserves a special provider implementation.

## Guardrails

- built-in protected route rules remain unchanged
- authoring output must remain a DSL plan, not raw sing-box JSON
- fallback behavior must still prefer deterministic generation over partial failure
