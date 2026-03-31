# Design

## Provider Model

The authoring layer now has explicit provider modes:

- `deterministic`
  Built-in parser with keyword and template mapping.

- `auto`
  Try a supported local AI CLI, then fall back to deterministic.

- `claude`
  Built-in structured adapter for the local `claude` CLI.

- `exec`
  Generic adapter for any local command that can emit a JSON authoring plan.

## Safety Boundary

- Providers only generate authoring plans.
- Plans are normalized into the same DSL structure used elsewhere.
- The compiler and runtime pipeline remain unchanged:
  - write DSL
  - build config
  - verify
  - apply

## Auto Fallback

Local AI CLIs are often installed but not always healthy or non-interactive in a given terminal session. `auto` therefore:

1. tries a local AI CLI adapter
2. enforces a timeout
3. falls back to deterministic authoring
4. records a note so the user can see what happened

## Exec Provider

The generic exec adapter makes the project provider-neutral. It passes:

- the prompt
- the JSON schema
- the authoring context

through placeholders and environment variables, and expects a JSON plan on stdout.

## Validation Strategy

1. unit tests for deterministic, exec, and auto-fallback flows
2. CLI tests for `author`
3. doctor output showing detected local AI CLIs
4. real smoke using:
   - `authoring.provider=auto`
   - low timeout
   - a real local environment with installed AI CLIs
