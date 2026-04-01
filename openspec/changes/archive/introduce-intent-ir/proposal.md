# Proposal

## Summary

Introduce a first-class `IntentIR` layer between user-facing inputs and the sing-box compiler.

## Motivation

The current pipeline allows natural-language authoring, builder config defaults, and the DSL loader
to influence compiler output directly. This keeps the MVP fast, but it couples authoring,
verification, preview, and compilation too tightly. The next phase needs a stable internal policy
representation so that:

- natural language and DSL compile into the same internal model
- compiler input is deterministic and testable
- verify plans and publish history can be derived from the same policy source
- future rollback and diff views can show intent-level changes instead of only JSON changes

## Scope

- add a versioned `IntentIR` model
- compile DSL into `IntentIR`
- compile natural-language plans into `IntentIR`
- merge multiple intent sources into one effective intent object
- make the sing-box compiler consume `IntentIR` instead of DSL rules directly
- add snapshot and unit coverage for `DSL -> IntentIR`, `prompt -> IntentIR`, and `IntentIR -> config`

## Non-goals

- replacing all user-visible YAML with IR immediately
- removing the existing DSL
- large directory refactors

