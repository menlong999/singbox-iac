# Validation

## Date

- 2026-03-31 01:20:19 CST

## Static Validation

- `npm run lint` -> PASS
- `npm test` -> PASS
- `npm run build` -> PASS

## Release Validation

- `npm run release:check` -> PASS
- `npm run release:dry-run` -> PASS

## Dry-Run Publish Result

The staged publish flow completed successfully:

1. run `release:check`
2. create a temporary publishable package copy
3. override `private: false` only inside that staging directory
4. neutralize `prepare` and `prepack` there because the staged package already contains compiled `dist`
5. run `npm publish --dry-run`

Observed result:

```text
npm notice Publishing to https://registry.npmjs.org/ with tag latest and default access (dry-run)
+ singbox-iac-builder@0.1.0
```

## Notes

- An initial dry-run failure exposed a real packaging issue: the staged package inherited build hooks that expected `tsconfig.json` to exist in the temporary publish directory.
- The staged package now overrides `prepare` and `prepack` to no-op commands during the dry run.
- `npm pkg fix --dry-run` produced no actionable output after the final changes.
