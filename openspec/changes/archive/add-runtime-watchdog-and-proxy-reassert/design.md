# Design

The watchdog should be narrowly scoped and boring.

## Scope

Only the `system-proxy` desktop profile is in scope for this change.

## Behavior

At a fixed interval:

- resolve current runtime state
- if process is missing, report unhealthy but do not restart automatically in this change
- if process is healthy and proxy drift is detected, reassert system proxy
- record the last successful reassert time

## Observability

`status` should show whether watchdog support is enabled and the latest reassert result when available.
