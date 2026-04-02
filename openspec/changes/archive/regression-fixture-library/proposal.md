# Proposal

## Change ID

`regression-fixture-library`

## Why

The project now has more structure in its pipeline:

- `IntentIR`
- `DNSPlan`
- `VerificationPlan`
- transactional apply

That raises the value of high-signal regression fixtures based on real routing failures and edge cases. The most important regressions are no longer generic parser bugs; they are configuration semantics and routing behavior.

## What Changes

- add a dedicated regression fixture library for real-world routing cases
- store fixture inputs and expected structured outputs
- validate compiler output, verification plan output, and key routing assertions per fixture
- focus first on developer-relevant failure modes already seen in this project

## Out of Scope

- full integration tests for every live external service
- protocol expansion beyond current support
- synthetic GUI client fixture coverage
