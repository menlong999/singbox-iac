# Proposal

## Change ID

`intent-patch-and-layered-authoring`

## Why

Natural-language `use` is currently too close to replacement semantics. That makes it easy for users to accidentally lose earlier intent when they only meant to add or adjust one rule.

Daily usage needs a layered model:

- a stable base intent
- incremental user patches
- explicit full replacement only when requested

## What Changes

- make `use` default to patch/merge semantics
- add explicit replacement semantics through a dedicated flag
- preserve unchanged existing intent when the new prompt only mentions one additional policy
- separate authored base intent from incremental patches in a stable internal structure

## Out of Scope

- conversational multi-turn editing
- direct JSON mutation
- provider-specific AI memory outside repository state
