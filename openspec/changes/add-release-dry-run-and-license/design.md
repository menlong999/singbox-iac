# Design: Add Release Dry-Run and License

## License Choice

Use MIT as the default open-source license for the CLI. It is simple, common for developer tooling, and easy to adopt unless a future relicensing decision is made.

## Publish Dry-Run Strategy

The repository stays `"private": true` until the final public package name is chosen. To still validate publish readiness:

1. run `release:check`
2. create a temporary staging directory
3. copy `dist`, `docs`, `examples`, `README`, and `LICENSE`
4. write a staged `package.json` with:
   - `private: false`
   - optional name override from `SINGBOX_IAC_PACKAGE_NAME`
5. run `npm publish --dry-run` inside the staging directory

## Failure Handling

- success: delete the staging directory
- failure: keep the staging directory for debugging
