# Proposal

## Change ID

`add-runtime-watchdog-and-proxy-reassert`

## Why

Detecting drift is useful, but daily replacement of GUI clients requires the runtime to recover from common proxy-state loss automatically.

The current desktop runtime does not yet reassert system proxy state when macOS clears it.

## What Changes

- add a lightweight runtime watchdog for `system-proxy` desktop mode
- periodically verify:
  - runtime process is alive
  - `in-mixed` listener is active
  - macOS system proxy still points to the configured endpoint
- default the watchdog interval to 60 seconds so it stays lightweight in steady state
- reassert proxy state when the process is healthy but proxy state drifted
- persist watchdog state only when the recorded result changes
- expose watchdog activity in logs and status

## Out of Scope

- sleep/wake integration
- full process supervisor behavior
- TUN watchdog behavior
