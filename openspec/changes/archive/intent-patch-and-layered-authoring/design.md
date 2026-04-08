# Design

Authoring should become layered:

- base authored plan: durable user policy set recovered from existing DSL/config or an explicit replacement
- patch plans: incremental prompt-derived updates appended over time
- merged plan / merged intent: what preview, build, verify, status, and generated DSL consume

## CLI Semantics

- `use '<prompt>'` means patch by default
- `use '<prompt>' --replace` means rebuild authored intent from this prompt

## Persistence

- layered authoring state should live in a stable file derived from the configured generated-rules path
- generated DSL remains an output artifact and should be rewritten from the merged authored plan
- builder config remains the place for selector defaults, verification expectations, and schedule metadata, but those values should now be driven by the merged authored plan

## Merge Principle

If a prompt only mentions a specific service, site bundle, or process bundle, the system should not erase unrelated prior intent.

Example:

- existing: AI/Dev -> HK, Stitch -> US, CN -> direct
- new prompt: `NotebookLM 走美国`
- result: add NotebookLM -> US while preserving the earlier defaults
