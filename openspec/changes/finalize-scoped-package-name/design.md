# Design: Finalize Scoped Package Name

## Package Identity

Use:

- npm package: `@singbox-iac/cli`
- installed binary: `singbox-iac`

This preserves a short runtime command while aligning the published package with a stable namespace.

## Repository Impact

- `package.json` and `package-lock.json` must use the scoped name
- user-facing install docs must mention the scoped tarball name
- release docs should treat the scoped name as the default, not merely a candidate

## Verification

Run:

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npm run release:check`
5. `npm run release:dry-run`

The final dry run should publish as `@singbox-iac/cli` in npm's dry-run output.
