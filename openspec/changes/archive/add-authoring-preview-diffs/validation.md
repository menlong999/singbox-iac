# Validation

Date: 2026-03-30

## Tooling

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅

## Unit And CLI Coverage

- Expanded `tests/cli/author.test.ts` with a preview test that verifies:
  - preview output includes diff sections
  - the rules file is unchanged
  - the builder config is unchanged
  - the staging file is not written

## Real Preview Smoke

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config .cache/authoring-smoke/builder.config.local.yaml \
  --provider deterministic \
  --prompt 'OpenRouter 走香港，YouTube Netflix 走美国，每60分钟自动更新' \
  --preview
```

Result:

- preview completed successfully
- no files were written
- output included:
  - `Rules diff`
  - `Builder config diff`
  - `Staging config diff`
- the diff correctly showed:
  - the current generated site bundle rules being replaced
  - `schedule.intervalMinutes` changing from `45` to `60`
  - the staged sing-box routing changes that would result from the new prompt

Artifacts remained unchanged:

- config:
  - `/Users/lvyuanfang/Code/SingBoxConfig/.cache/authoring-smoke/builder.config.local.yaml`
- rules:
  - `/Users/lvyuanfang/Code/SingBoxConfig/.cache/authoring-smoke/rules/custom.rules.yaml`
