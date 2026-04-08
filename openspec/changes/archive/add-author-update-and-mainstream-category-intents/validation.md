# Validation

Date: 2026-03-31

## Static Validation

- `npm run typecheck`
  - PASS
- `npm run lint`
  - PASS
- `npm test -- --run tests/natural-language/natural-language.test.ts tests/rule-templates/rule-templates.test.ts tests/cli/author.test.ts`
  - PASS

## Real One-Sentence Author-Update Smoke

Ran:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config ./.cache/author-update-smoke/builder.config.local.yaml \
  --provider deterministic \
  --rules-out /Users/lvyuanfang/Code/SingBoxConfig/.cache/author-update-smoke/custom.rules.yaml \
  --prompt "Google 服务和 GitHub 这类开发类都走香港，Gemini 走新加坡，Apple 服务走香港，Amazon Prime 和 Apple TV 走新加坡，Antigravity 进程级走美国，每30分钟自动更新" \
  --update \
  --live-path /Users/lvyuanfang/Code/SingBoxConfig/.cache/author-update-smoke/live.json \
  --backup-path /Users/lvyuanfang/Code/SingBoxConfig/.cache/author-update-smoke/backup.json
```

Result:

- PASS
- provider requested: `deterministic`
- provider used: `deterministic`
- templates inferred:
  - `developer-common-sites`
  - `video-sg`
- generated rules:
  - Google service explicit HK override
  - GitHub HK override
  - Gemini SG override
  - Apple HK override
- schedule interval updated to `30`
- `verify` passed with `15/15`
- live config published to the temporary live path
- backup config written to the temporary backup path
