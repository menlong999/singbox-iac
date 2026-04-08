# Proposal: Add Simple User Rules DSL

## Why

The project already exposes `rules.userRulesFile`, but it is only a placeholder. Users still cannot express simple custom routing intent without editing generated sing-box JSON or changing source code.

We need a minimal DSL that is:

- easier than raw sing-box JSON
- strong enough for day-to-day overrides
- constrained enough to preserve protected routing invariants

## What Changes

- Add a YAML DSL loader for user-authored routing rules.
- Insert user rules into explicit compiler phases:
  - `beforeBuiltins`
  - `afterBuiltins`
- Validate rule targets and rule-set references during compilation.
- Add a real custom-rule verification scenario to prove the DSL is active in the runtime path.

## Impact

- Users can customize routing behavior without touching generated JSON.
- Route customization remains bounded and deterministic.
- Real-subscription verification can now cover custom rule behavior end to end.
