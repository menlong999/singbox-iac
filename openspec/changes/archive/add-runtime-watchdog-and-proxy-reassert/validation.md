# Validation: add-runtime-watchdog-and-proxy-reassert

Date: 2026-04-08

## Targeted Validation

Executed successfully:

- `npm test -- tests/runtime-watchdog/runtime-watchdog.test.ts tests/cli/runtime.test.ts tests/cli/status.test.ts tests/cli/status-drift-output.test.ts tests/status/status.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Covered cases:

- watchdog tick detects proxy drift and records a successful reassert
- watchdog keeps the 60-second default interval in generated LaunchAgents
- watchdog does not rewrite the persisted state when repeated healthy ticks produce the same result
- `start` / `stop` / `restart` now manage the watchdog LaunchAgent alongside the desktop runtime LaunchAgent
- `status` shows watchdog enablement, last result, and last message when state exists

## Local Command Validation

Executed successfully against `builder.config.local.yaml`:

- `./node_modules/.bin/tsx src/cli/index.ts runtime-watchdog --config builder.config.local.yaml --json`
- `./node_modules/.bin/tsx src/cli/index.ts runtime-watchdog --config builder.config.local.yaml --json` (repeated after 2 seconds)
- `./node_modules/.bin/tsx src/cli/index.ts status --config builder.config.local.yaml --json`
- `./node_modules/.bin/tsx src/cli/index.ts status --config builder.config.local.yaml`

Observed local results:

- watchdog state file was written to `~/.config/singbox-iac/runtime-watchdog/org.singbox-iac.runtime.watchdog.json`
- watchdog reported `lastResult=healthy`
- repeated healthy watchdog ticks returned the same `lastCheckedAt`, confirming unchanged state no longer rewrites the state file
- `status` reported the runtime as healthy and surfaced:
  - `Watchdog: enabled=true label=org.singbox-iac.runtime.watchdog installed=false interval=60s last-result=healthy ...`
  - `Watchdog message: Runtime and macOS proxy state are healthy.`
- local `status` also correctly warned that the watchdog LaunchAgent is not yet installed for the current runtime

## Repository Check

Executed:

- `npm test`

Observed unrelated existing failures outside this change:

- `tests/cli/apply.test.ts`
  - failed with `EPERM` while copying a snapshot into `~/.config/singbox-iac/generated/snapshots/...`
- `tests/cli/build.test.ts`
  - expects only `in-mixed` and `in-proxifier`, but the generated config currently includes `in-tun`
- `tests/verification/verification.test.ts`
  - failed with `listen EPERM: operation not permitted 127.0.0.1`
