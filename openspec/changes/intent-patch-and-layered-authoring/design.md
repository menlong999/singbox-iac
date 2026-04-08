# Design

Authoring should become layered:

- base intent: durable user policy set
- patch intent: the newest requested change
- merged intent: what the compiler actually consumes

## CLI Semantics

- `use '<prompt>'` means patch by default
- `use '<prompt>' --replace` means rebuild authored intent from this prompt

## Merge Principle

If a prompt only mentions a specific service, site bundle, or process bundle, the system should not erase unrelated prior intent.

Example:

- existing: AI/Dev -> HK, Stitch -> US, CN -> direct
- new prompt: `NotebookLM 走美国`
- result: add NotebookLM -> US while preserving the earlier defaults
