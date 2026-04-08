# Validation

Date: 2026-03-31

## Repository validation

- `PATH=/usr/local/bin:$PATH npm run lint` -> PASS
- `PATH=/usr/local/bin:$PATH npm test` -> PASS
- `PATH=/usr/local/bin:$PATH npm run build` -> PASS
- `PATH=/usr/local/bin:$PATH npm run release:check` -> PASS

## Focused command validation

- `go` wrapper test -> PASS
- `use` wrapper test -> PASS
- `update` command output now reports `Reload: triggered|skipped` -> PASS
- CLI help now highlights `go`, `use`, and `update` as the primary commands -> PASS
- Advanced commands are hidden from the default top-level help output -> PASS
- Default config resolution prefers `~/.config/singbox-iac/builder.config.yaml` over cwd-local files -> PASS
- Subscription fetch retries recover from transient `ECONNRESET` and HTTP `503` failures -> PASS
- Process-proxy runtime verification treats a successful proxy `CONNECT` as route-level success for timeout-prone upstreams -> PASS

## Installed-package smoke validation

- Clean temp `HOME` + temp working directory smoke with global install -> PASS
- `go <subscription-url> <prompt> --force --no-run --no-load` using the real subscription and `SING_BOX_BIN` override -> PASS
- `use '<new prompt>' --preview` against the generated home config -> PASS
- `update` against the generated home config -> PASS
- `npm view @singbox-iac/cli version` after publish -> `0.1.6`
- Fresh registry install of `@singbox-iac/cli@0.1.6` plus `singbox-iac --help` -> PASS

Observed smoke outputs:

- `go` completed with `Verified scenarios: 7/7`
- `use --preview` rendered staged diffs without mutating files
- `update` completed with `Verified scenarios: 7/7`

## Notes

- `go` is the shortest first-run path and wraps the existing ready onboarding flow.
- `use` wraps intent authoring plus closed-loop update.
- `update` now auto-reloads only when the configured `sing-box` runtime target is already active, so the daily command no longer needs `--reload` in the common case.
