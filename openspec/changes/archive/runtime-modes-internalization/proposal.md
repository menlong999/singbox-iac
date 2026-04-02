# Proposal

## Change ID

`runtime-modes-internalization`

## Why

The project already implies multiple runtime styles:

- browser proxy
- process-aware proxy
- headless daemon updates

Those modes currently exist as hidden combinations of defaults, command flows, and verification behavior. Internalizing runtime modes will make the codebase easier to evolve without forcing extra complexity onto users.

## What Changes

- add an internal `RuntimeMode` model
- map current onboarding and runtime defaults onto explicit modes
- let `go` and related flows infer a mode instead of forcing the user to choose one
- use the mode to guide default listener, DNS, verification, and schedule behavior

## Out of Scope

- requiring users to specify a mode during onboarding
- shipping TUN support as part of this change
- Linux runtime support in the same implementation batch
