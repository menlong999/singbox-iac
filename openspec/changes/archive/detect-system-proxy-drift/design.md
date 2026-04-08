# Design

`status` should treat proxy drift as a runtime-state mismatch, not a generic warning.

## Expected State

When desktop runtime profile is `system-proxy` and the runtime agent is running, expected state is:

- `sing-box` process exists
- `in-mixed` listener is active
- macOS system proxy points to the configured `in-mixed` endpoint

## Drift States

At minimum, detect:

- process running but system proxy inactive
- process running but system proxy host/port do not match configured `in-mixed`
- runtime configured for `system-proxy` but no listener is active

## Output

`status` output should clearly show:

- expected desktop profile
- current system proxy state
- whether drift is present
- a short next action hint
