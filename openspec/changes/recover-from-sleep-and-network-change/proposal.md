# Proposal

## Change ID

`recover-from-sleep-and-network-change`

## Why

A common macOS failure mode is that runtime and network state diverge after sleep/wake or Wi-Fi changes.

Manual `restart` is an acceptable workaround, but not a product-level daily-driver experience.

## What Changes

- add recovery hooks or recovery-aware runtime checks for sleep/wake and network-change events
- prefer light recovery first:
  - reassert proxy
  - refresh listener health
- escalate to runtime restart only when lighter recovery fails
- make recovery activity visible in diagnostics

## Out of Scope

- full TUN lifecycle management
- OS-wide daemon supervision
- non-macOS implementations
