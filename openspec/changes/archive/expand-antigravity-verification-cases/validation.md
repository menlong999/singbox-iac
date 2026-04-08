# Validation

Date: 2026-03-30

## Tooling

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅

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
  - OpenAI platform -> `🇭🇰 香港 01`
  - Gemini -> `🇭🇰 香港 01`
  - Anthropic -> `🇭🇰 香港 01`
  - GitHub -> `🇭🇰 香港 01`
  - General Google services -> `🇭🇰 香港 01`

Artifacts:

- Staging config: `/Users/lvyuanfang/Code/SingBoxConfig/.cache/generated/config.staging.json`
- Verification config: `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-1Hzs3a/verify.config.json`
- Verification log: `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-1Hzs3a/sing-box.log`
