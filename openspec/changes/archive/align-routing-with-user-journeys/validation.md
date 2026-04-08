# Validation

Date: 2026-03-30

## Static Checks

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm test` ✅

## Real Subscription Build

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts build
```

Result:

- Parsed `36` Trojan nodes from the real subscription.
- Generated staging config at `/Users/lvyuanfang/Code/SingBoxConfig/.cache/generated/config.staging.json`.
- Verified selector defaults in the generated config:
  - `Process-Proxy.default = "🇺🇸 美国 07 - OnlyAI"`
  - `AI-Out.default = "HK"`
  - `Dev-Common-Out.default = "HK"`
  - `Stitch-Out.default = "US"`

## Closed-Loop Verification

Command:

```bash
./node_modules/.bin/tsx src/cli/index.ts verify
```

Result: all configured scenarios passed with a temporary `sing-box` instance and headless Chrome.

- Antigravity auth via proxifier -> `🇺🇸 美国 07 - OnlyAI`
- Antigravity docs via proxifier -> `🇺🇸 美国 07 - OnlyAI`
- Google Stitch -> `🇺🇸 美国 01`
- China traffic -> `direct`
- ChatGPT -> `🇭🇰 香港 01`
- OpenAI platform -> `🇭🇰 香港 01`
- Gemini -> `🇭🇰 香港 01`
- Anthropic -> `🇭🇰 香港 01`
- GitHub -> `🇭🇰 香港 01`
- General Google services -> `🇭🇰 香港 01`

Artifacts:

- Verification config: `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-VIJZIC/verify.config.json`
- Verification log: `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-VIJZIC/sing-box.log`
