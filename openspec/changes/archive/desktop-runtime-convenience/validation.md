# Validation

## Summary

Added desktop runtime convenience for macOS: builder configs now persist an internal desktop
runtime profile, compiler output can emit `set_system_proxy` or `tun` inbounds, `singbox-iac`
gained `start` / `stop` / `restart`, and `status` now reports desktop runtime LaunchAgent plus
system proxy or TUN hints.

## Automated Verification

Executed on 2026-04-02 in `/Users/lvyuanfang/Code/SingBoxConfig`:

```bash
npm run typecheck
npx vitest run tests/runtime-mode/runtime-mode.test.ts tests/desktop-runtime/desktop-runtime.test.ts tests/cli/runtime.test.ts tests/cli/status.test.ts tests/compiler/compiler.test.ts
npm run fixtures:regenerate
npm run lint
npm test
npm run release:check
```

## Runtime Smoke

Executed a real sing-box config smoke check for the new TUN profile:

```bash
./node_modules/.bin/tsx src/cli/index.ts build --config <temp-builder-config> --subscription-file tests/fixtures/subscriptions/trojan-sample.b64
/Users/lvyuanfang/Code/SingBoxConfig/.tools/sing-box-1.13.4-darwin-arm64/sing-box check -c <temp-staging-config>
```

## Results

- targeted desktop runtime tests: passed (`17` tests)
- regression fixture regeneration: updated expected compiled-config snapshots for explicit
  `set_system_proxy`
- `lint`: passed
- full `npm test`: passed (`37` files, `90` tests)
- `release:check`: passed, including pack-and-install smoke validation
- real `sing-box check` against a generated `tun` profile config: passed

## Behavioral Checks

- browser/process desktop profiles now default to `system-proxy`
- prompts mentioning `TUN` or global capture infer the `tun` desktop profile
- `start` writes a dedicated runtime LaunchAgent that runs `sing-box run -c <live-config>`
- `stop` removes that runtime LaunchAgent
- `restart` rewrites the runtime LaunchAgent after re-checking the live config
- `status` reports desktop runtime profile, LaunchAgent state, and best-effort system proxy / TUN
  activity hints
