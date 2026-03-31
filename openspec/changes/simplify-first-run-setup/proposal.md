# Proposal: Simplify First-Run Setup

## Why

After npm installation, the first-run flow still required too many manual steps. Developer users should be able to get from install to a usable staging config with one command.

## What Changes

- add a `setup` command for first-run onboarding
- include the user-level config path in default config discovery
- make `init` work from a globally installed package instead of assuming a local `examples/` directory in the current working tree
- optionally generate first-run rules from one natural-language prompt
- automatically sync the configured local rule sets during setup

## Non-Goals

- replacing `author`, `build`, or `update` for advanced workflows
- adding support for more proxy protocols
