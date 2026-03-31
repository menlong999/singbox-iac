# Proposal: Add macOS Ops Commands

## Why

The project already supports build, verify, and update flows, but the remaining day-to-day operator commands were still placeholders:

- `init`
- `doctor`
- `schedule install`
- `schedule remove`

Without these commands, the project is harder to onboard, harder to diagnose, and harder to run as a long-lived macOS background workflow.

## What Changes

- Implement `init` to generate starter config assets.
- Implement `doctor` to inspect local environment readiness.
- Implement `schedule install` and `schedule remove` for macOS `launchd`.
- Add tests and a real temporary-directory validation loop for these commands.

## Impact

- New users can bootstrap the project faster.
- Operators can diagnose missing binaries, config, rules, and rule-set files.
- The generated config pipeline can now be scheduled through `launchd` without hand-written plist files.
