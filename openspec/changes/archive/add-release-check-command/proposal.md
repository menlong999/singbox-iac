# Proposal: Add Release Check Command

## Why

Packaging is now installable, but the verification flow still depends on manually re-running several commands. A single repository command should validate release readiness end to end.

## What Changes

- add a `release:check` script
- run static validation, package creation, clean-directory install, and installed CLI help smoke in one flow
- keep debug artifacts only when the flow fails
- document the command for local dogfooding and future release work

## Non-Goals

- publishing to npm
- choosing the final public package name or license
