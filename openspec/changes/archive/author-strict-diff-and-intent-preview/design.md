# Design

## Core Principle

Natural-language authoring should behave like a deterministic intent compiler with explicit failure modes.

That means:

- human-friendly input is allowed
- ambiguous intent is not silently guessed
- every accepted authoring request can be rendered as `IntentIR`
- the user can inspect the resulting diff before publish

## Strict Mode

`--strict` should reject phrases that cannot be mapped to a concrete routing outcome. Examples:

- `快一点`
- `大部分`
- `差不多`
- `AI 都走好一点的节点`

Accepted output must resolve to:

- concrete service or category targets
- concrete outbound groups or built-in group defaults
- optional verification expectations that remain machine-checkable

## Diff Rendering

`--diff` should not show raw sing-box JSON first. The primary diff should be:

- `IntentIR` changes
- group default changes
- verification expectation changes
- generated DSL changes when a DSL file is written

The final compiled config diff can remain secondary for advanced users.

## Intent IR Emission

`--emit-intent-ir` should render a stable JSON object so users and tests can compare structured intent, not just final config output.

This output becomes the canonical debugging layer between authoring and compiler behavior.
