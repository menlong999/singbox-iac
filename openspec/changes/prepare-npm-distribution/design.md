# Design: Prepare npm Distribution

## Distribution Shape

The package remains source-driven in the repository, but the distributed artifact should be compiled:

- binary entrypoint: `dist/cli/index.js`
- library export: `dist/index.js`
- package contents: `dist`, `README`, `docs`, and `examples`

## Build Hooks

Use both `prepare` and `prepack`:

- `prepare` supports repository installs that need a fresh `dist`
- `prepack` guarantees `npm pack` and later npm publishing always rebuild first

## Verification

The required smoke path is:

1. `npm test`
2. `npm run build`
3. `npm pack`
4. install the tarball in a clean temp directory
5. run `./node_modules/.bin/singbox-iac --help`

This verifies the packaged binary rather than only the source tree.
