# Releasing

This repository is prepared for npm-style distribution. The default package name is now:

```json
"name": "@singbox-iac/cli"
```

The repository has now completed its first public publish path.

## Current Published Package

The first package version has now been published as:

- `@singbox-iac/cli@0.1.0`

The runtime binary remains:

- `singbox-iac`

## Current Release Safety Commands

Use these two commands before any real publish:

```bash
npm run release:check
npm run release:dry-run
```

`release:check` verifies:

- typecheck
- lint
- tests
- build
- `npm pack`
- clean-directory install
- installed `singbox-iac --help`

`release:dry-run` first runs `release:check`, then stages a publishable package copy with:

- `private: false`
- a publish name
- compiled `dist`
- docs/examples/README/LICENSE

and finally runs:

```bash
npm publish --dry-run
```

## Package Name
The chosen default publish target is:

- `@singbox-iac/cli`

The installed command remains:

- `singbox-iac`

## Dry-Run with a Candidate Name

You can still test an alternate future publish name without changing the repository package metadata:

```bash
SINGBOX_IAC_PACKAGE_NAME=@singbox-iac/experimental-cli npm run release:dry-run
```

## Real Publish Checklist

1. confirm the license choice
2. ensure you are logged into npm with access to the `singbox-iac` organization
3. run `npm run release:check`
4. run `npm run release:dry-run`
5. publish from a clean working tree with `npm publish --access public`

## Notes

- `release:dry-run` keeps its staging directory on failure for debugging.
- `release:check` and `release:dry-run` both avoid mutating the live repository package metadata.
