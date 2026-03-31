# Proposal: Improve Onboarding README And Setup Flow

## Why

The public repository and npm package are usable, but the first-run experience still needs to feel more obvious and more trustworthy for developer users. The project should explain its architecture and security posture clearly, and `setup` should do more of the first-run readiness work automatically.

## What Changes

- add bilingual architecture and user-journey documentation to the README
- document the local-first security posture and the core developer-facing capabilities
- improve `setup` so it can surface environment readiness automatically
- allow `setup` to optionally perform verification and publish steps as part of onboarding

## Non-Goals

- changing the core compiler architecture
- adding support for more proxy protocols
