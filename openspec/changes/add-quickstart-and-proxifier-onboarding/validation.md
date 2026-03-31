# Validation

Date: 2026-03-31

## Repository validation

- `npm run lint` -> PASS
- `npm test` -> PASS (`22` files, `43` tests)
- `npm run build` -> PASS
- `npm run release:check` -> PASS

## Real npm install smoke

Environment:

- tarball install into isolated `HOME`
- real subscription URL
- real onboarding prompt:
  - `我需要给 proxifier 单独设置进程级的入口，出口到美国；所有 ai 类、开发工具网站类，出口到香港节点；google stitch 相关出口到美国；国内直连`

Command shape:

```bash
singbox-iac quickstart \
  --subscription-url '<real-subscription>' \
  --prompt '<real-prompt>' \
  --sing-box-bin /opt/homebrew/opt/sing-box/bin/sing-box \
  --chrome-bin '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --force \
  --no-run \
  --no-load
```

Observed result:

- PASS
- bundled default rule sets were used for all 10 common tags
- generated config under isolated `~/.config/singbox-iac/`
- generated Proxifier helper directory automatically
- built `config.staging.json`
- verified `11/11` scenarios
- published live config into isolated `~/.config/sing-box/config.json`
- wrote LaunchAgent plist without loading it

## Foreground runtime smoke

Command shape:

```bash
singbox-iac quickstart \
  --subscription-url '<real-subscription>' \
  --prompt '<real-prompt>' \
  --sing-box-bin /opt/homebrew/opt/sing-box/bin/sing-box \
  --chrome-bin '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --force \
  --no-load
```

Observed result:

- PASS
- `quickstart` started foreground `sing-box`
- automatic visible Chrome launch worked for both `in-mixed` and `in-proxifier`
- observed lines:
  - `Opened Chrome for in-proxifier ... via 127.0.0.1:39091`
  - `Opened Chrome for in-mixed ... via 127.0.0.1:39097`
  - `Running sing-box in foreground: .../config.json`
- temporary processes were cleaned up after smoke

## Additional robustness changes validated in this round

- default runtime DNS now uses `dns-local-default` with remote resolvers kept as fallback servers
- ruleset sync now has per-item progress output
- ruleset sync now prefers bundled common `.srs` assets before network download
- ruleset sync still supports retry-based remote download for non-bundled tags

## Publish result

- published package: `@singbox-iac/cli@0.1.5`
- confirmed via `npm view @singbox-iac/cli version` -> `0.1.5`
