# Validation

Date: 2026-03-31

## Tooling

- `npm run lint` ✅
- `npm test` ✅
- `npm run build` ✅
- `npm run release:check` ✅

## Functional Coverage

- `setup` now supports `--run` to continue into a foreground `sing-box` process after a successful onboarding flow.
- `setup` now supports `--open-browser`, and `--ready --run` automatically opens isolated Chrome windows unless explicitly skipped.
- visible browser windows are grouped by inbound and use the generated mixed and proxifier listener ports.
- visible verification targets are selected from the user's natural-language prompt instead of always opening a fixed static set.
- runtime verification now uses request-driven checks so onboarding validation is not destabilized by headless browser background traffic.
- scheduled updates now inherit explicit `SING_BOX_BIN` and `CHROME_BIN` paths when onboarding provides them.

## Published Package

- Published `@singbox-iac/cli@0.1.4` to npm.
- Installed the published package globally and confirmed `singbox-iac --version` returned `0.1.4`.

## Real First-Run Flow

- Ran a clean-room onboarding flow with:
  - a fresh temporary `HOME`
  - the maintainer's real subscription URL
  - the real routing prompt:
    - proxifier/process-level traffic -> US
    - AI and developer sites -> HK
    - Google Stitch -> US
    - China traffic -> direct
- Command used:
  - `singbox-iac setup --subscription-url ... --prompt ... --ready --run --label org.singbox-iac.realflow2 --sing-box-bin ... --chrome-bin ...`
- The flow completed successfully through:
  - config init
  - rule-set download
  - natural-language authoring
  - staging build
  - runtime verification
  - live publish
  - launchd schedule install
  - foreground `sing-box` run
  - visible Chrome launch for mixed and proxifier scenarios

## Real Verification Results

- `Verified scenarios: 11/11`
- Verified routing outcomes included:
  - proxifier / Antigravity-related traffic -> `🇺🇸 美国 01`
  - `stitch.withgoogle.com` -> `🇺🇸 美国 01`
  - `www.baidu.com` -> `direct`
  - `chatgpt.com` -> `🇭🇰 香港 01`
  - `openrouter.ai` -> `🇭🇰 香港 01`
  - `github.com` -> `🇭🇰 香港 01`
- Confirmed live listeners on:
  - `127.0.0.1:39097`
  - `127.0.0.1:39091`
- Confirmed visible Chrome windows opened with isolated profiles:
  - one proxifier-style window on `39091`
  - one mixed window on `39097`
- Confirmed the generated LaunchAgent plist passed `plutil -lint`.
- Confirmed the generated LaunchAgent had `last exit code = 0` under `launchctl print` when run with the isolated onboarding environment.
- Confirmed the generated LaunchAgent environment included:
  - `SING_BOX_BIN=/Users/lvyuanfang/Code/SingBoxConfig/.tools/sing-box-1.13.4-darwin-arm64/sing-box`
  - `CHROME_BIN=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

## Cleanup

- Stopped the foreground `sing-box` instance after validation.
- Removed the temporary LaunchAgent created for the isolated verification run.
- Closed the isolated Chrome verification windows.
