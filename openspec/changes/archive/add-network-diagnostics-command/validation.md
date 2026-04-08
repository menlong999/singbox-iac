# Validation

- `npm test -- tests/diagnostics/diagnostics.test.ts tests/cli/diagnose.test.ts tests/cli/index.test.ts tests/cli/status.test.ts tests/cli/doctor.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `./node_modules/.bin/tsx src/cli/index.ts diagnose --config builder.config.local.yaml`
- `./node_modules/.bin/tsx src/cli/index.ts diagnose --config builder.config.local.yaml --json`

## Result

- Targeted diagnostics and CLI tests passed: `5` files, `11` tests.
- TypeScript, lint, and build all passed.
- Local `diagnose` human-readable output returned `PASS 12 WARN 0 FAIL 0`.
- Local `diagnose --json` returned the same `12/0/0` summary with embedded `status` snapshot.
- On this machine, `default-route` required a fallback from `/usr/sbin/route` to `/sbin/route`; that fallback is now implemented and covered by unit tests.
- Local status evidence still surfaced one existing runtime warning unrelated to this change: watchdog is enabled in config but its LaunchAgent is not installed for the currently running runtime session.
