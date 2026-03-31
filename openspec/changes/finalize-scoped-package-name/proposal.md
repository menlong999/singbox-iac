# Proposal: Finalize Scoped Package Name

## Why

The project now has a real npm organization and a clear package layout direction. The repository should stop treating `@singbox-iac/cli` as a tentative candidate and make it the default package identity.

## What Changes

- change the repository package name to `@singbox-iac/cli`
- update installation and release docs to treat the scoped name as canonical
- update tests and lockfile metadata
- verify `release:check` and `release:dry-run` with the scoped name as the default

## Non-Goals

- performing the first real publish
- changing the runtime CLI command name (`singbox-iac`)
