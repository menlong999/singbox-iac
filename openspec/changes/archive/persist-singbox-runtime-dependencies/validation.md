# Validation

## Summary

Persisted runtime dependency support was implemented for `sing-box` and Chrome. Successful doctor
and setup flows now write resolved binary paths back into `builder.config.yaml`, runtime commands
prefer those persisted paths, and the update LaunchAgent inherits them by default.

## Automated Verification

Executed on 2026-04-02 in `/Users/lvyuanfang/Code/SingBoxConfig`:

```bash
npm run typecheck
npx vitest run tests/runtime-dependencies/runtime-dependencies.test.ts \
  tests/cli/doctor.test.ts \
  tests/cli/schedule.test.ts \
  tests/cli/setup.test.ts \
  tests/cli/update.test.ts \
  tests/manager/manager.test.ts
npm run lint
npm test
npm run release:check
```

## Results

- `typecheck`: passed
- targeted runtime dependency and CLI tests: passed
- `lint`: passed
- full `npm test`: passed (`34` files, `82` tests)
- `release:check`: passed, including pack-and-install smoke validation

## Behavioral Checks

- `doctor` persists explicit `sing-box` and Chrome paths into builder config
- `setup` persists detected runtime dependency paths during first-run onboarding
- `schedule install` uses persisted paths when no explicit `--sing-box-bin` or `--chrome-bin`
  flags are provided
- `update` succeeds using persisted `sing-box` path without requiring a CLI override
- invalid persisted `sing-box` paths fall back to ambient discovery in the runtime dependency
  resolver
