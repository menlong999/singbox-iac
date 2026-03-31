# Validation

Date: 2026-03-30

## Tooling

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅

## Unit And Integration Coverage

- Added `tests/user-rules/user-rules.test.ts` for DSL parsing and missing-file warnings.
- Expanded `tests/compiler/compiler.test.ts` to prove custom rules are inserted ahead of built-ins.

## Real-Subscription Verification

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts verify
```

Result:

- Static checks passed:
  - route priority ordering
  - default domain resolver
  - DNS shape
- Runtime scenarios passed:
  - Antigravity auth via proxifier -> `🇺🇸 美国 07 - OnlyAI`
  - Antigravity OAuth metadata via proxifier -> `🇺🇸 美国 07 - OnlyAI`
  - Antigravity docs via proxifier -> `🇺🇸 美国 07 - OnlyAI`
  - Antigravity rules docs via proxifier -> `🇺🇸 美国 07 - OnlyAI`
  - Antigravity MCP docs via proxifier -> `🇺🇸 美国 07 - OnlyAI`
  - Antigravity Google API discovery via proxifier -> `🇺🇸 美国 07 - OnlyAI`
  - Google Stitch -> `🇺🇸 美国 01`
  - China direct -> `direct`
  - ChatGPT -> `🇭🇰 香港 01`
  - OpenRouter custom DSL rule -> `🇭🇰 香港 01`
  - OpenAI platform -> `🇭🇰 香港 01`
  - Gemini -> `🇭🇰 香港 01`
  - Anthropic -> `🇭🇰 香港 01`
  - GitHub -> `🇭🇰 香港 01`
  - General Google services -> `🇭🇰 香港 01`

Artifacts:

- Staging config: `/Users/lvyuanfang/Code/SingBoxConfig/.cache/generated/config.staging.json`
- Verification config: `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-BAPzRC/verify.config.json`
- Verification log: `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-BAPzRC/sing-box.log`

## Closed-Loop Publish

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts update --live-path .cache/generated/config.dsl-live.json --backup-path .cache/generated/config.dsl-backup.json
```

Result:

- Build passed with 36 nodes.
- Verify passed with `15/15` scenarios.
- Published live config to `/Users/lvyuanfang/Code/SingBoxConfig/.cache/generated/config.dsl-live.json`.
- Confirmed generated route contains:

```json
{"domain_suffix":["openrouter.ai"],"action":"route","outbound":"AI-Out"}
```

- Backup file was not created because the temporary live path did not already exist before the publish.
