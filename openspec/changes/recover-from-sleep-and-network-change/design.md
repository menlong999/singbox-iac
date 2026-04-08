# Design

Recovery should be event-aware when possible and state-aware always.

## Recovery Ladder

1. detect network or wake transition
2. check runtime process health
3. reassert proxy if runtime is healthy
4. restart runtime only if health check still fails

## Constraints

- recovery should not assume `TUN`
- recovery should not destroy a healthy runtime unnecessarily
- logs should make it obvious whether the system performed reassert-only recovery or a full runtime restart
