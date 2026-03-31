# Proposal: Improve Ready Onboarding Runtime Validation

## Why

The onboarding flow already supports `setup --ready`, but first-time developer users still need too much manual work to see the resulting `sing-box` instance in action. The CLI should be able to continue into a live foreground run, open visible browser windows on the correct proxy ports, and select representative verification targets directly from the user's natural-language routing prompt.

## What Changes

- extend `setup` so it can continue into a foreground `sing-box` run after successful onboarding
- allow `setup` to open isolated visible Chrome windows on the mixed and proxifier ports
- derive those visible verification targets from the user's natural-language prompt when possible
- harden runtime verification so the automated onboarding flow is stable against browser background traffic noise

## Non-Goals

- changing the underlying compiler model
- adding support for more proxy protocols
