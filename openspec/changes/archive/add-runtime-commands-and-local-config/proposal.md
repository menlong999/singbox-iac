# Change Proposal: add-runtime-commands-and-local-config

## Summary

Add safe runtime-facing commands and a real local builder config so the MVP can be used directly for staged `build`, `check`, `apply`, and `run` flows.

## Why

The compiler MVP is usable, but daily operation still needs command support for validation, publishing, and foreground execution. A real local config also removes repetitive command arguments.

## Scope

- add `check` command
- add `run` command
- implement `apply` command
- implement `reload` command
- add a real local builder config for the current workstation

