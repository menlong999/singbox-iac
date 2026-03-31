# Validation

## Date

- 2026-03-31 03:46:05 CST

## Publish Preconditions

- `npm whoami` -> `menlong999`
- `npm run release:check` -> PASS

## Publish Result

- `npm publish --access public` -> PASS
- published package: `@singbox-iac/cli@0.1.0`

## Ownership Verification

Using authenticated organization access listing:

```json
{
  "@singbox-iac/cli": "read-write"
}
```

## Notes

- Immediately after publish, public `npm view @singbox-iac/cli` lookups still returned `404`. This appears to be registry/index propagation delay rather than publish failure.
- Authenticated access listing confirmed the package exists under the `@singbox-iac` organization.
