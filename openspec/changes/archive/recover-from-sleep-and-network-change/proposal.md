# Proposal

## Change ID

`recover-from-sleep-and-network-change`

## Why

A common macOS failure mode is that runtime and network state diverge after sleep/wake or Wi-Fi changes.

Manual `restart` is an acceptable workaround, but not a product-level daily-driver experience.

## What Changes

- treat the existing runtime watchdog as the minimum viable recovery signal source instead of adding a new always-on event watcher
- make the watchdog detect the common post-sleep and post-network-change symptoms within its normal polling cycle
- prefer light recovery first:
  - reassert proxy
  - refresh listener health
- escalate to runtime restart only when lighter recovery fails
- guard repeated runtime restarts with a fixed 5-minute cooldown so a bad environment does not churn every 60 seconds
- make recovery activity visible in diagnostics

## Out of Scope

- a separate LaunchAgent that subscribes to native sleep/wake or network-change notifications
- full TUN lifecycle management
- OS-wide daemon supervision
- non-macOS implementations
