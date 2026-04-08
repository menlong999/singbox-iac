# Proposal: add-route-verification-harness

## Why

The MVP can now build and run a working `sing-box` config, but the project still lacks a repeatable way to prove that critical route policies are behaving as intended with real traffic. Manual spot checks are not enough for confidence in special-case policies such as Stitch, AI egress, China direct routing, and proxifier precedence.

## What Changes

- add a `verify` CLI command
- build a verification harness that starts `sing-box` with a temporary verification config
- launch isolated Chrome traffic through the generated proxy listeners
- assert route behavior from real runtime logs and static config invariants

## Impact

- users can run a deterministic closed-loop verification pass locally
- route regressions become easier to detect before applying live configs
