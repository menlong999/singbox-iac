# Proposal

## Summary

Persist resolved runtime dependencies, especially the `sing-box` binary path, so onboarding,
updates, scheduling, and diagnostics all operate on the same executable and browser tools.

## Motivation

The current CLI can discover `sing-box` from explicit flags, environment variables, repository
fixtures, and `PATH`, but that discovery happens at runtime on every command. This causes three
practical issues:

- first-run onboarding can succeed while later scheduled updates resolve a different binary
- users cannot easily see which `sing-box` executable the tool actually trusts
- replacing Clash Verge requires stable runtime behavior, not ad hoc binary guessing

For desktop adoption, dependency discovery must become deterministic after the first successful
setup.

## Scope

- add persisted runtime dependency fields to builder config
- persist resolved `sing-box` and optional Chrome paths during onboarding and explicit doctor/setup
  flows
- make runtime commands prefer persisted paths over ambient discovery
- ensure schedule installation exports persisted runtime dependency paths
- improve installation guidance when `sing-box` is missing

## Non-goals

- downloading or bundling `sing-box` into the npm package
- cross-platform package installation automation
- replacing the existing runtime reload model
