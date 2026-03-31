# Validation

## Date

- 2026-03-31 01:06:04 CST

## Static Validation

- `npm run typecheck` -> PASS
- `npm run lint` -> PASS
- `npm test` -> PASS (`18` test files, `34` tests)
- `npm run build` -> PASS

## Package Smoke

- `npm pack` -> PASS
- clean temp install directory created at `/tmp/singbox-iac-pack-smoke.LzsjMw`
- tarball installed from `/Users/lvyuanfang/Code/SingBoxConfig/singbox-iac-builder-0.1.0.tgz`
- installed binary command `./node_modules/.bin/singbox-iac --help` -> PASS

## Installed CLI Output

```text
Usage: singbox-iac [options] [command]

Policy-first subscription compiler for sing-box on macOS.

Options:
  -V, --version     output the version number
  -h, --help        display help for command
```

## Notes

- A real packaging bug was found during smoke validation: direct-entrypoint detection based on `import.meta.url === file://${process.argv[1]}` failed when the installed binary was invoked through npm's symlinked `.bin` path.
- The CLI now resolves both paths with `realpathSync`, and a dedicated test covers the symlinked invocation case.
