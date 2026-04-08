# Design: bootstrap-repo

## Decisions

### Single-package CLI

Use a single Node.js package instead of a monorepo. The product is one CLI with one runtime artifact model.

### Package by capability

Use `fetcher`, `parser`, `compiler`, `manager`, and `cli` module boundaries to match the product architecture.

### OpenSpec as the source of truth

Capability specs describe long-lived behavior. Incremental work is tracked under `changes/`.

### YAML config for user entry

Users will configure the CLI via a YAML file rather than hand-editing raw `sing-box` JSON.

### DSL before natural language

Rule customization will first converge on a validated YAML DSL. Natural-language support, if added later, must compile into the DSL rather than directly mutating generated configs.

## Consequences

- Early phases can focus on correctness rather than UI or plugin complexity.
- Compiler behavior can be specified independently from provider subscription input.
- Later features such as more protocols or natural-language rule authoring can evolve without destabilizing the core architecture.

