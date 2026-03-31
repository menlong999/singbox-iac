# Validation

Date: 2026-03-30

## Static Checks

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm test` ✅

## Automated Test Coverage

- Added `tests/cli/update.test.ts` to verify that `update` can build and publish with `--skip-verify` using a fake `sing-box` binary.

## Real Subscription Update Flow

Preparation:

```bash
printf '{"previous":"live"}\n' > .cache/generated/config.publish-test.json
```

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts update \
  --live-path .cache/generated/config.publish-test.json \
  --backup-path .cache/generated/config.publish-test.backup.json
```

Result:

- Built the real subscription into the staging config.
- Ran the full closed-loop verification harness and passed `10/10` configured scenarios.
- Published the verified config to `.cache/generated/config.publish-test.json`.
- Preserved the previous live file in `.cache/generated/config.publish-test.backup.json`.

Post-checks:

- Published config route final: `Global`
- Published `Process-Proxy.default`: `🇺🇸 美国 07 - OnlyAI`
- Published `AI-Out.default`: `HK`
- Backup file content remained `{"previous":"live"}`
