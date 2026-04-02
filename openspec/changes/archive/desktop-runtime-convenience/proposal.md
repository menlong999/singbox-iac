# Proposal

## Summary

Add a desktop runtime convenience layer so `singbox-iac` can approach the everyday ergonomics of a
 GUI client on macOS without becoming a full GUI application.

## Motivation

To replace Clash Verge in daily use, the tool must be convenient at runtime, not only strong at
compilation. The main missing behaviors are:

- system proxy can be enabled and cleaned up automatically
- TUN mode can be started and stopped predictably
- users can start, stop, and inspect the desktop runtime without manually composing `sing-box` and
  launchd commands

The official `sing-box` runtime already supports mixed inbound `set_system_proxy` on macOS and
supports `tun` inbound with `auto_route`; the CLI now needs to expose those capabilities in a safe,
opinionated way.

## Scope

- add desktop runtime modes for system-proxy and tun-based operation
- add start/stop/restart commands for the local desktop runtime
- add a dedicated runtime LaunchAgent separate from the update scheduler
- generate runtime-aware config defaults so system proxy and TUN behavior are explicit
- integrate runtime state into status/diagnostics

## Non-goals

- a menu bar app or graphical dashboard
- cross-platform service management beyond macOS
- replacing Proxifier for process-level routing
