# Validation

Date: 2026-03-30

## Tooling

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅

## CLI Tests

- Added `tests/cli/init.test.ts`
- Added `tests/cli/doctor.test.ts`
- Added `tests/cli/schedule.test.ts`

## Real Temporary-Directory Flow

Workspace:

- `/Users/lvyuanfang/Code/SingBoxConfig/.cache/cli-flow-smoke`

Commands:

```bash
./node_modules/.bin/tsx src/cli/index.ts init \
  --config-out .cache/cli-flow-smoke/builder.config.local.yaml \
  --rules-out .cache/cli-flow-smoke/custom.rules.yaml \
  --subscription-url https://example.com/smoke-subscription

./node_modules/.bin/tsx src/cli/index.ts doctor \
  --config .cache/cli-flow-smoke/builder.config.local.yaml \
  --launch-agents-dir .cache/cli-flow-smoke/LaunchAgents

./node_modules/.bin/tsx src/cli/index.ts schedule install \
  --config .cache/cli-flow-smoke/builder.config.local.yaml \
  --launch-agents-dir .cache/cli-flow-smoke/LaunchAgents \
  --logs-dir .cache/cli-flow-smoke/logs \
  --label org.singbox-iac.smoke \
  --no-load

plutil -lint .cache/cli-flow-smoke/LaunchAgents/org.singbox-iac.smoke.plist

./node_modules/.bin/tsx src/cli/index.ts schedule remove \
  --label org.singbox-iac.smoke \
  --launch-agents-dir .cache/cli-flow-smoke/LaunchAgents \
  --no-unload
```

Results:

- `init` generated both config and rules assets.
- Generated builder config correctly pointed `rules.userRulesFile` at the generated rules file.
- `doctor` reported `PASS` for:
  - macOS
  - builder config
  - `sing-box`
  - Chrome
  - LaunchAgents directory
  - user rules file
  - all configured rule-set files
  - schedule config
- `schedule install --no-load` generated a valid plist.
- `plutil -lint` reported `OK`.
- Generated LaunchAgent uses:
  - `/Users/lvyuanfang/Code/SingBoxConfig/node_modules/.bin/tsx`
  - `/Users/lvyuanfang/Code/SingBoxConfig/src/cli/index.ts`
  - `update --config /Users/lvyuanfang/Code/SingBoxConfig/.cache/cli-flow-smoke/builder.config.local.yaml`
- `schedule remove --no-unload` removed the plist successfully.
