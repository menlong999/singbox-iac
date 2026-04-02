# Validation

## Summary

Added a unified `singbox-iac status` command that reports resolved runtime dependencies, process
state, listener activity, schedule installation state, live config presence, and the most recent
publish transaction. The command supports both human-readable and JSON output.

## Automated Verification

Executed on 2026-04-02 in `/Users/lvyuanfang/Code/SingBoxConfig`:

```bash
npm run typecheck
npx vitest run tests/cli/status.test.ts tests/cli/history.test.ts tests/cli/doctor.test.ts tests/transactions/transactions.test.ts
npm run lint
npm test
npm run release:check
```

## Results

- `typecheck`: passed
- targeted status/transaction tests: passed
- `lint`: passed
- full `npm test`: passed (`35` files, `84` tests)
- `release:check`: passed, including pack-and-install smoke validation

## Behavioral Checks

- `status` shows the resolved `sing-box` binary path and source
- `status` reports whether the runtime process is currently running and which listener ports are
  active
- `status` reports whether the update LaunchAgent is installed and loaded
- `status` reports the latest transaction id and status from publish history
- `status --json` produces machine-readable output suitable for future UI or automation layers
