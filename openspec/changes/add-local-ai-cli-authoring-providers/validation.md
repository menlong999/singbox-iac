# Validation

Date: 2026-03-30

## Tooling

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅

## Unit And CLI Coverage

- Added `tests/authoring/authoring.test.ts` for:
  - deterministic provider
  - exec-provider success
  - auto-provider fallback
- Existing `tests/cli/author.test.ts` continues to cover authoring output, staging build, and LaunchAgent generation.
- Existing `tests/cli/doctor.test.ts` continues to cover doctor output flow.

## Local Environment Detection

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts doctor --config .cache/authoring-smoke/builder.config.local.yaml
```

Result:

- detected local AI CLIs:
  - `claude=/opt/homebrew/bin/claude (builtin)`
  - `gemini=/usr/local/bin/gemini`
  - `codex=/usr/local/bin/codex`
- confirmed:
  - `authoring-provider: provider=auto, timeoutMs=1000`

## Real Local-Environment Authoring Smoke

The temporary config at:

- `/Users/lvyuanfang/Code/SingBoxConfig/.cache/authoring-smoke/builder.config.local.yaml`

was updated to:

```yaml
authoring:
  provider: auto
  timeoutMs: 1000
```

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config .cache/authoring-smoke/builder.config.local.yaml \
  --prompt '开发者网站走香港，AI 工具走香港，视频网站走新加坡，每45分钟自动更新' \
  --install-schedule \
  --force-schedule \
  --launch-agents-dir .cache/authoring-smoke/LaunchAgents \
  --logs-dir .cache/authoring-smoke/logs \
  --label org.singbox-iac.authoring-auto-smoke \
  --no-load
```

Result:

- `Provider requested: auto`
- `Provider used: deterministic`
- note emitted:
  - `Auto authoring fell back from claude to the deterministic parser: The "claude" CLI did not produce a plan within 1000 ms.`
- generated templates:
  - `developer-common-sites`
  - `developer-ai-sites`
  - `video-sg`
- wrote staging config:
  - `/Users/lvyuanfang/Code/SingBoxConfig/.cache/authoring-smoke/generated/config.staging.json`
- wrote LaunchAgent plist:
  - `/Users/lvyuanfang/Code/SingBoxConfig/.cache/authoring-smoke/LaunchAgents/org.singbox-iac.authoring-auto-smoke.plist`

This proves that a developer machine with local AI CLIs installed does not block authoring if the selected local AI CLI is unusable in the current session.

## Closed-Loop Verification After Auto Fallback

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
  - `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-y3OJsB/verify.config.json`
- sing-box log:
  - `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-y3OJsB/sing-box.log`
