# Design

Recovery should stay state-aware first and reuse the existing watchdog architecture.

The MVP does not add a new event-watcher process. Instead, the watchdog's normal 60-second tick is the signal source that detects the common symptoms left behind by sleep/wake or network changes.

## Recovery Ladder

1. watchdog tick observes a post-transition symptom
2. check runtime process health and `in-mixed` listener health
3. reassert proxy if runtime is healthy but system proxy drifted
4. restart runtime only if health check still fails or the runtime is already unhealthy
5. verify the runtime state after restart and report the outcome

## Constraints

- do not add a second always-on LaunchAgent just for native macOS event subscriptions in this change
- recovery should not assume `TUN`
- recovery should not destroy a healthy runtime unnecessarily
- runtime restart attempts should be guarded by a fixed 5-minute cooldown
- logs and status should make it obvious whether the system performed reassert-only recovery, skipped restart because of cooldown, or escalated to a full runtime restart
