# Validation: detect-system-proxy-drift

Date: 2026-04-08

## Targeted Validation

Executed successfully:

- `npm test -- tests/status/status.test.ts tests/cli/status.test.ts tests/cli/status-drift-output.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Covered drift cases:

- active runtime with no enabled macOS system proxy reports `state=inactive` and `drift=true`
- active runtime with a mismatched macOS proxy endpoint reports `state=endpoint-mismatch` and `drift=true`
- human-readable `status` output prints the expected `in-mixed` endpoint, the observed proxy endpoints, and the next-action hint

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
