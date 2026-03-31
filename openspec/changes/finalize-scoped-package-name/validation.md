# Validation

## Date

- 2026-03-31 02:12:24 CST

## Metadata Validation

- `package.json` default package name -> `@singbox-iac/cli`
- `package-lock.json` root package name -> `@singbox-iac/cli`
- installed binary name remains `singbox-iac`

## Static Validation

- `npm run lint` -> PASS
- `npm test` -> PASS
- `npm run build` -> PASS

## Release Validation

- `npm run release:check` -> PASS
- `npm run release:dry-run` -> PASS

## Observed Dry-Run Publish Result

```text
npm notice name: @singbox-iac/cli
npm notice filename: singbox-iac-cli-0.1.0.tgz
npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access (dry-run)
+ @singbox-iac/cli@0.1.0
```

## Notes

- The scoped package name is now the default repository identity, not merely an override candidate.
- The CLI command remains unchanged for end users: `singbox-iac`.
