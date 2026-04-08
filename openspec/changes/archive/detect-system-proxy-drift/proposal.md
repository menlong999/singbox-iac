# Proposal

## Change ID

`detect-system-proxy-drift`

## Why

The current desktop runtime relies on `system-proxy` mode for daily use, but the most common real-world failure is that macOS proxy state drifts away from the expected runtime state after sleep, network changes, or external interference.

The project already has `status`, but it needs to make drift explicit and actionable.

## What Changes

- define explicit drift detection for `system-proxy` desktop runtime
- compare expected proxy state against current macOS proxy state
- surface drift in `status` as a first-class runtime warning
- distinguish between:
  - runtime stopped
  - runtime running with proxy active
  - runtime running with proxy drift

## Out of Scope

- automatic repair
- sleep or network-change hooks
- TUN mode implementation changes
