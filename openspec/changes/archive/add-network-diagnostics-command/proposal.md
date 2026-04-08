# Proposal

## Change ID

`add-network-diagnostics-command`

## Why

Users need a single command that answers practical questions such as:

- is `sing-box` running
- is system proxy active
- is the current DNS environment suspicious
- did the latest runtime publish succeed

Today this information is scattered across `doctor`, `status`, and manual shell commands.

## What Changes

- add a higher-level diagnostics command, for example `singbox-iac diagnose`
- summarize runtime, listener, proxy, DNS, and recent transaction state in one place
- include best-effort local-network checks that help explain failures outside the compiler itself

## Out of Scope

- automatic repair
- remote connectivity benchmarking
- full egress capability scoring
