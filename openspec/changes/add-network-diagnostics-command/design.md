# Design

The diagnostics command should focus on practical, high-signal checks.

## Minimum Sections

- runtime process and listener state
- system proxy state
- current config and live-config presence
- schedule presence
- recent transaction summary
- best-effort DNS environment checks

## DNS Diagnostics

Do not overclaim. This command should report suspicious conditions and evidence, not declare root cause with certainty.

Examples:

- system resolver differs from expected runtime path
- well-known domains resolve to unexpected IP ranges
- direct resolver probes fail while the proxy path is healthy
