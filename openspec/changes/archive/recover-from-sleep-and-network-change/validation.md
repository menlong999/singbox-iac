# Validation: recover-from-sleep-and-network-change

Date: 2026-04-08

## Targeted Validation

Executed successfully:

- `npm test -- tests/runtime-watchdog/runtime-watchdog.test.ts tests/cli/runtime.test.ts tests/cli/status.test.ts tests/cli/status-drift-output.test.ts tests/status/status.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Covered cases:

- proxy drift is still recovered by watchdog proxy reassert
- proxy drift escalates from reassert to runtime restart when reassert does not restore health
- repeated unhealthy runtime state respects the fixed 5-minute restart cooldown
- `status` surfaces watchdog recovery action and trigger fields when they exist

## Local Command Validation

Executed successfully against `builder.config.local.yaml`:

- `./node_modules/.bin/tsx src/cli/index.ts runtime-watchdog --config builder.config.local.yaml --json`
- `./node_modules/.bin/tsx src/cli/index.ts status --config builder.config.local.yaml`

Observed local results:

- watchdog still returned `lastResult=healthy`
- the returned watchdog state kept `lastCheckedAt=2026-04-08T11:58:28.579Z` even when re-run later, confirming unchanged healthy state still does not rewrite the state file
- `status` still reported the runtime as healthy with `interval=60s`
- local `status` still correctly warned that the watchdog LaunchAgent is not yet installed for the current runtime

## Repository Check

Executed:

- `npm test`

Observed unrelated existing failures outside this change:

- `tests/cli/build.test.ts`
  - still expects only `in-mixed` and `in-proxifier`, but generated config also contains `in-tun`
- `tests/cli/update.test.ts`
  - still expects `Reload: skipped`, but current CLI output reports `Reload: triggered`
