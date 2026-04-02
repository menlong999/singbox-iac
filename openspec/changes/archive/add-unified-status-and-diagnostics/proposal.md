# Proposal

## Summary

Add a single `status` and diagnostics surface that explains the current runtime state without
forcing users to stitch together `doctor`, `verify`, `pgrep`, `lsof`, and launchd checks manually.

## Motivation

The project is now intended to replace a daily GUI workflow. GUI clients feel approachable because
users can quickly answer:

- is the proxy core running?
- which config is live?
- which local ports are listening?
- is the update scheduler installed?
- what happened during the last publish or verification run?

Today that information is scattered across multiple commands and the filesystem. A unified status
surface is needed before everyday desktop use is trustworthy.

## Scope

- add a `singbox-iac status` command
- report runtime dependency health, config paths, process status, listening ports, schedule state,
  and last transaction summary
- include actionable next steps when the runtime is misconfigured
- support a machine-readable JSON mode for future UI or scripting use

## Non-goals

- remote telemetry or metrics export
- replacing `doctor` or `verify`
- a full GUI dashboard
