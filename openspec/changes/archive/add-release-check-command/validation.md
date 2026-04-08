# Validation

## Date

- 2026-03-31 01:11:00 CST

## Static Validation

- `npm run lint` -> PASS

## Release Check

- `npm run release:check` -> PASS

The command completed the full intended flow:

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. `npm pack`
6. clean-directory `npm install`
7. installed `singbox-iac --help`

## Observed Installed CLI Output

```text
Usage: singbox-iac [options] [command]

Policy-first subscription compiler for sing-box on macOS.
```

## Notes

- The command now acts as the canonical repeatable distribution smoke for the repository.
- It cleans up the tarball and temporary install directory on success.
- It intentionally preserves those artifacts on failure to support debugging.
