# Proposal

## Summary

Introduce transactional publish semantics for `apply`/`update`, plus `history` and `rollback`
commands.

## Motivation

The project already has staging/live/backup paths, but it does not yet model publishes as
transactions. A policy compiler without transaction history and rollback remains operationally
fragile.

## Scope

- add `ApplyTransaction`
- persist publish history
- keep multiple snapshots instead of a single backup
- add rollback command
- add history command
- make `update` and `apply` write transaction records

## Non-goals

- full distributed state management
- remote snapshot storage

