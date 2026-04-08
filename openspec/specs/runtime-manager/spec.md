# Runtime Manager

## Goal

Validate, publish, and reload generated `sing-box` configs safely.

## Requirements

- The system must generate a staging config before publish.
- The system must validate staging configs with `sing-box check`.
- The live config must only be replaced after successful validation.
- Publish and reload failures must be surfaced clearly.
- The system should preserve a last-known-good config when possible.
- `status` must report the configured desktop runtime profile when available.
- For `system-proxy` desktop runtime, `status` must compare the expected `in-mixed` endpoint against the current macOS system proxy state.
- For `system-proxy` desktop runtime, `status` must distinguish between healthy proxy state, inactive proxy state, and proxy endpoint drift.
- When proxy drift is detected, `status` must surface the expected endpoint, the observed proxy endpoint state, and a short operator-facing next action hint.
- For `system-proxy` desktop runtime, the system must support a lightweight watchdog with a default 60-second recheck interval.
- The `system-proxy` watchdog must verify process health, `in-mixed` listener health, and current macOS proxy state before attempting repair.
- When the runtime process is healthy and proxy drift is detected, the watchdog should reassert the expected macOS proxy endpoint before considering runtime restart.
- The current sleep/wake and network-change recovery path should reuse the watchdog's regular checks instead of requiring a separate event-listener agent.
- When post-transition symptoms leave the runtime unhealthy, the watchdog should escalate from proxy reassert to runtime restart only when lighter recovery fails or the runtime is already unhealthy.
- Runtime restart escalation should be guarded by a fixed 5-minute cooldown so repeated failures do not churn every watchdog interval.
- The watchdog should persist status changes without rewriting identical recorded state on every poll.
- `status` must report whether watchdog support is enabled, the latest recorded watchdog result, and the latest recovery action when available.
