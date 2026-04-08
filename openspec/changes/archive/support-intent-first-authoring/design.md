# Design

## Core Principle

Natural-language authoring should behave like an intent compiler, not a prompt passthrough.

That means one sentence may affect more than one layer:

- explicit user rules for specific services
- built-in group defaults for category-level requests
- verification expectations for scenarios that would otherwise remain pinned to old assumptions

## Intent Mapping

### Service-specific

Requests like `Gemini 走新加坡` should generate a concrete explicit rule before built-ins.

### Category-level

Requests like `开发类都走香港` should update the relevant selector default instead of forcing the user to name `Dev-Common-Out`.

### Process-aware

Requests like `Antigravity 进程级走美国节点` should map onto the existing proxifier flow and, when possible, update the Process-Proxy selector default.

## Verification Alignment

If an explicit intent changes the effective outbound for an existing verification URL, authoring should update the configured expected outbound so the closed-loop verification remains truthful.
