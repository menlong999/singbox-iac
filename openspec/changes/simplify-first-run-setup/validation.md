# Validation

Date: 2026-03-31

## Tooling

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅
- `npm run build` ✅
- `npm run release:check` ✅

## Test Coverage

- Added `tests/cli/setup.test.ts` to verify first-run setup using the default user config path, local rule-set sync, and staging build.
- Expanded `tests/cli/init.test.ts` to verify `init` works from a current working directory that does not contain a local `examples/` directory.

## Real First-Run Smoke

Temporary directories:

- root:
  - `/tmp/singbox-iac-setup-smoke.KdCBUH`
- home:
  - `/tmp/singbox-iac-setup-smoke.KdCBUH/home`
- workspace:
  - `/tmp/singbox-iac-setup-smoke.KdCBUH/workspace`

Temporary subscription server:

- `python3 -m http.server 38441 --bind 127.0.0.1`
- served fixture:
  - `/tmp/singbox-iac-setup-smoke.KdCBUH/server/subscription.b64`

Commands:

```bash
HOME=/tmp/singbox-iac-setup-smoke.KdCBUH/home \
/Users/lvyuanfang/Code/SingBoxConfig/.tools/node-v22.20.0-darwin-arm64/bin/node \
/Users/lvyuanfang/Code/SingBoxConfig/dist/cli/index.js setup \
  --subscription-url 'http://127.0.0.1:38441/subscription.b64' \
  --prompt 'Google 服务和 GitHub 走香港，Gemini 走新加坡，Antigravity 进程级走美国，每45分钟自动更新'

HOME=/tmp/singbox-iac-setup-smoke.KdCBUH/home \
/Users/lvyuanfang/Code/SingBoxConfig/.tools/node-v22.20.0-darwin-arm64/bin/node \
/Users/lvyuanfang/Code/SingBoxConfig/dist/cli/index.js build

HOME=/tmp/singbox-iac-setup-smoke.KdCBUH/home \
/Users/lvyuanfang/Code/SingBoxConfig/.tools/sing-box-1.13.4-darwin-arm64/sing-box check \
  -c /tmp/singbox-iac-setup-smoke.KdCBUH/home/.config/singbox-iac/generated/config.staging.json
```

Results:

- `setup` succeeded from a clean workspace with no local config files.
- Default config path resolution wrote:
  - `/tmp/singbox-iac-setup-smoke.KdCBUH/home/.config/singbox-iac/builder.config.yaml`
- Default rules path resolution wrote:
  - `/tmp/singbox-iac-setup-smoke.KdCBUH/home/.config/singbox-iac/rules/custom.rules.yaml`
- Setup downloaded `10` default local `.srs` rule sets and reported `0` failures.
- Setup generated the first staging config at:
  - `/tmp/singbox-iac-setup-smoke.KdCBUH/home/.config/singbox-iac/generated/config.staging.json`
- Setup generated `4` parsed nodes from the served fixture subscription.
- Running `build` again from the same clean workspace without `--config` succeeded, confirming default config discovery now includes the user-level config path.
- `sing-box check` passed on the staged config.

## Distribution Smoke

- `npm run release:check` still passed after the first-run simplification changes.
- The packed tarball remained installable and the installed `singbox-iac --help` entrypoint worked.
