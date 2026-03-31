# Validation: add-mvp-ruleset-routing

Date: 2026-03-30

## Local Rule Sets Downloaded

Downloaded to `~/.config/sing-box/rule-set`:

- `geosite-cn.srs`
- `geoip-cn.srs`
- `geosite-google.srs`
- `geosite-google-gemini.srs`
- `geosite-google-deepmind.srs`
- `geosite-anthropic.srs`
- `geosite-github.srs`
- `geosite-github-copilot.srs`
- `geosite-cursor.srs`
- `geosite-figma.srs`

## Compiler Behavior Validated

Generated config now includes:

- `AI-Out`
- `Dev-Common-Out`
- `Stitch-Out`
- `direct`

Validated route order:

1. `sniff`
2. reject `udp:443`
3. hijack DNS
4. route `in-proxifier` to `Process-Proxy`
5. route `stitch.withgoogle.com` to `Stitch-Out`
6. route AI rule sets to `AI-Out`
7. route developer/common rule sets to `Dev-Common-Out`
8. route China rule sets to `direct`

## Automated Validation

Executed successfully:

- `npm run typecheck`
- `npm test`
- `tsx src/cli/index.ts build --subscription-url <user-url> --output .cache/generated/config.real.json`
- `sing-box check -c .cache/generated/config.real.json`

## Runtime Smoke Test

To avoid collisions with the active local proxy setup:

- duplicated the generated config
- changed inbound ports to `28897` and `28891`
- launched `sing-box run` for 2 seconds
- confirmed the process remained healthy and both listeners started

Observed startup lines included:

- `inbound/mixed[in-mixed]: tcp server started at 127.0.0.1:28897`
- `inbound/mixed[in-proxifier]: tcp server started at 127.0.0.1:28891`
- `sing-box started`
