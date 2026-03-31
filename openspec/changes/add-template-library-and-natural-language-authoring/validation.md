# Validation

Date: 2026-03-30

## Tooling

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅

## Unit And CLI Coverage

- Added `tests/rule-templates/rule-templates.test.ts` for template catalog coverage.
- Expanded `tests/natural-language/natural-language.test.ts` for generic developer/video prompt mapping and schedule inference.
- Existing `tests/cli/author.test.ts` continues to cover prompt -> rules -> staging config -> LaunchAgent generation.

## Real Smoke Flow

Temporary config root:

- `/Users/lvyuanfang/Code/SingBoxConfig/.cache/authoring-smoke`

The smoke flow used a temporary copy of the local builder config with temporary staging/live/backup paths and the real subscription URL.

### Template Catalog

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts templates list
```

Result:

- listed `developer-ai-sites`
- listed `developer-common-sites`
- listed `video-us`
- listed `video-hk`
- listed `video-sg`
- listed `video-jp`
- listed `cn-video-direct`

### Natural-Language Authoring

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config .cache/authoring-smoke/builder.config.local.yaml \
  --prompt '开发者网站走香港，AI 工具走香港，视频网站走新加坡，每45分钟自动更新' \
  --install-schedule \
  --force-schedule \
  --launch-agents-dir .cache/authoring-smoke/LaunchAgents \
  --logs-dir .cache/authoring-smoke/logs \
  --label org.singbox-iac.authoring-smoke \
  --no-load
```

Result:

- generated rules file:
  - `/Users/lvyuanfang/Code/SingBoxConfig/.cache/authoring-smoke/rules/custom.rules.yaml`
- updated builder config:
  - `rules.userRulesFile` -> temporary rules file
  - `schedule.enabled` -> `true`
  - `schedule.intervalMinutes` -> `45`
- generated staging config:
  - `/Users/lvyuanfang/Code/SingBoxConfig/.cache/authoring-smoke/generated/config.staging.json`
- wrote a LaunchAgent plist:
  - `/Users/lvyuanfang/Code/SingBoxConfig/.cache/authoring-smoke/LaunchAgents/org.singbox-iac.authoring-smoke.plist`
- inferred templates:
  - `developer-common-sites`
  - `developer-ai-sites`
  - `video-sg`

### LaunchAgent Validation

Command:

```bash
plutil -lint .cache/authoring-smoke/LaunchAgents/org.singbox-iac.authoring-smoke.plist
```

Result:

- plist syntax valid

### Closed-Loop Route Verification

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts verify --config .cache/authoring-smoke/builder.config.local.yaml
```

Result:

- static checks passed:
  - route priority ordering
  - default domain resolver
  - DNS shape
- runtime scenarios passed `15/15`:
  - Antigravity auth -> `🇺🇸 美国 07 - OnlyAI`
  - Antigravity OAuth metadata -> `🇺🇸 美国 07 - OnlyAI`
  - Antigravity docs -> `🇺🇸 美国 07 - OnlyAI`
  - Antigravity rules docs -> `🇺🇸 美国 07 - OnlyAI`
  - Antigravity MCP docs -> `🇺🇸 美国 07 - OnlyAI`
  - Antigravity Google API discovery -> `🇺🇸 美国 07 - OnlyAI`
  - Google Stitch -> `🇺🇸 美国 01`
  - China direct -> `direct`
  - ChatGPT -> `🇭🇰 香港 01`
  - OpenRouter -> `🇭🇰 香港 01`
  - OpenAI platform -> `🇭🇰 香港 01`
  - Gemini -> `🇭🇰 香港 01`
  - Anthropic -> `🇭🇰 香港 01`
  - GitHub -> `🇭🇰 香港 01`
  - General Google services -> `🇭🇰 香港 01`

Artifacts:

- verification config:
  - `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-ozvJc9/verify.config.json`
- sing-box log:
  - `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-ozvJc9/sing-box.log`

### Closed-Loop Publish

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts update --config .cache/authoring-smoke/builder.config.local.yaml
```

Result:

- parsed `36` nodes from the real subscription
- verify passed with `15/15` scenarios
- published live config to:
  - `/Users/lvyuanfang/Code/SingBoxConfig/.cache/authoring-smoke/generated/config.live.json`
- wrote backup to:
  - `/Users/lvyuanfang/Code/SingBoxConfig/.cache/authoring-smoke/generated/config.backup.json`
- build warnings remained limited to the three skipped non-node subscription lines
