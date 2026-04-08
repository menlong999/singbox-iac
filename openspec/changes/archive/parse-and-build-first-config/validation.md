# Validation: parse-and-build-first-config

Date: 2026-03-30

## Local Tooling

- Installed local Node.js toolchain under `.tools/node-v22.20.0-darwin-arm64`
- Installed local `sing-box` binary under `.tools/sing-box-1.13.4-darwin-arm64`
- Installed project dependencies with local `npm`

## Repository Validation

Executed successfully:

- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm test`

## Real Subscription Validation

Input:

- user-provided subscription URL
- input was used only for local validation and not committed as a fixture

Observed behavior:

- provider endpoint returned different payload types depending on `User-Agent`
- raw subscription payload was obtained successfully with subscription-oriented `User-Agent` values
- payload contained `39` Trojan-style entries
- `3` entries were informational pseudo-nodes and were skipped
- `36` proxy nodes were compiled into the generated config

Successful commands:

- `tsx src/cli/index.ts build --subscription-url <user-url> --output .cache/generated/config.real.json`
- `sing-box check -c .cache/generated/config.real.json`
- `node dist/cli/index.js build --subscription-url <user-url> --output .cache/generated/config.dist.json`
- `sing-box check -c .cache/generated/config.dist.json`

## Runtime Smoke Test

To avoid port conflicts with the active Clash Verge setup:

- copied the generated config
- changed listener ports to `27897` and `27891`
- launched `sing-box run` in the foreground for 2 seconds
- confirmed the process stayed up and started both listeners successfully

Observed startup signals:

- `inbound/mixed[in-mixed]: tcp server started at 127.0.0.1:27897`
- `inbound/mixed[in-proxifier]: tcp server started at 127.0.0.1:27891`
- `sing-box started`

## Notes

- the current MVP does not apply or reload live configs
- no system proxy settings were modified during validation
- no Clash Verge processes were touched during validation
