# Design: Add Release Check Command

## Command Scope

`npm run release:check` should be the canonical local release readiness command.

It runs:

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. `npm pack`
6. clean-directory `npm install <tarball>`
7. installed `singbox-iac --help`

## Cleanup Policy

- success: remove the tarball and temporary install directory
- failure: keep both so the failure can be inspected manually

## Why a Node Script

A Node script avoids shell portability issues and can manage cleanup/reporting more predictably than a long inline shell command.
