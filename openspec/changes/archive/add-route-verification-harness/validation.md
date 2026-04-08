# Validation: add-route-verification-harness

Date: 2026-03-30

## Repository Validation

Executed successfully:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## End-to-End Verification Command

Executed successfully:

- `tsx src/cli/index.ts verify`

Verification artifacts:

- generated config: `/Users/lvyuanfang/Code/SingBoxConfig/.cache/generated/config.staging.json`
- temporary verification config: `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-aMgXPn/verify.config.json`
- sing-box runtime log: `/var/folders/7b/2tzmd5xd2937zhv713tkyh5w0000gn/T/singbox-iac-verify-aMgXPn/sing-box.log`

## Static Checks

Passed:

- route priority ordering
- `route.default_domain_resolver`
- emitted DNS server shape

Observed output:

- `PASS route-priority`
- `PASS default-domain-resolver`
- `PASS dns-shape`

## Runtime Route Scenarios

Passed:

- Google Stitch routes via `Stitch-Out` and the default US leaf outbound
- ChatGPT routes via the explicit AI domain rule and the default US leaf outbound
- Gemini routes via the AI rule set and the default US leaf outbound
- GitHub routes via `Dev-Common-Out` and the default US leaf outbound
- China traffic routes `direct` on the normal mixed inbound
- China traffic routed through `in-proxifier` overrides CN direct and uses the `Process-Proxy` default US leaf outbound

Observed command summary:

- `PASS Google Stitch routes via Stitch-Out default -> 🇺🇸 美国 01 (in-mixed)`
- `PASS ChatGPT routes via AI-Out explicit domain rule -> 🇺🇸 美国 01 (in-mixed)`
- `PASS Gemini routes via AI-Out ruleset -> 🇺🇸 美国 01 (in-mixed)`
- `PASS GitHub routes via Dev-Common-Out -> 🇺🇸 美国 01 (in-mixed)`
- `PASS China traffic routes direct on mixed inbound -> direct (in-mixed)`
- `PASS Proxifier inbound overrides CN direct rule -> 🇺🇸 美国 01 (in-proxifier)`
