# Proposal

## Change ID

`author-strict-diff-and-intent-preview`

## Why

The project now treats natural-language authoring as a first-class entrypoint, but it still needs stronger guardrails before it can be trusted as the default way to change routing policy.

Users need three things:

- a strict mode that refuses vague or ambiguous requests
- a diff mode that shows what will change before anything is applied
- a way to inspect the generated `IntentIR` directly

Without those capabilities, natural-language authoring is convenient but still harder to audit than it should be.

## What Changes

- add `--strict` to `use` and `author`
- add `--diff` output based on `IntentIR`, config defaults, and generated rules
- add `--emit-intent-ir` output for advanced inspection and debugging
- define a small set of ambiguity rules that are rejected instead of guessed
- make preview and diff output align with the current `IntentIR -> compile -> verify` pipeline

## Out of Scope

- free-form conversational policy editing
- direct editing of sing-box JSON through natural language
- provider-specific LLM integrations beyond the existing authoring provider layer
