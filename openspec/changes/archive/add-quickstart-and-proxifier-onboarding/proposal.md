# Proposal: Add Quickstart and Proxifier Onboarding

## Why

The CLI already supports `setup --ready`, but the first-run path still feels heavier than necessary for npm-installed users. Process-aware routing is also a core developer workflow, yet Proxifier onboarding still requires too much manual guesswork.

## What Changes

- add a `quickstart` command as the shortest opinionated first-run path
- add `proxifier bundles` and `proxifier scaffold` to generate process-aware helper assets
- let `setup` generate Proxifier helper files automatically when the prompt implies process-aware routing
- update user-facing docs so quickstart becomes the preferred onboarding path

## Expected Outcome

An npm-installed user should be able to provide a subscription URL and one sentence, then get:

- local config
- generated rules
- validated and published sing-box config
- a recurring schedule
- Proxifier helper files when process-aware routing is relevant
