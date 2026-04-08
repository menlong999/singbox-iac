# Change Proposal: bootstrap-repo

## Summary

Initialize the repository and specification baseline for `Sing-box IaC Builder`.

## Why

The project needs a stable foundation before protocol parsing and config generation begin. Without a spec baseline and a shared project skeleton, later phases will drift on:

- project scope
- route invariants
- CLI behavior
- runtime safety expectations
- user customization model

## Scope

This change establishes:

- repository structure
- TypeScript toolchain skeleton
- OpenSpec project baseline
- initial background documentation
- example configuration assets
- placeholder module boundaries

## Out of Scope

- real subscription fetching
- Trojan parsing implementation
- config compilation implementation
- runtime reload implementation

