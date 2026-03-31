# Runtime Manager

## Goal

Validate, publish, and reload generated `sing-box` configs safely.

## Requirements

- The system must generate a staging config before publish.
- The system must validate staging configs with `sing-box check`.
- The live config must only be replaced after successful validation.
- Publish and reload failures must be surfaced clearly.
- The system should preserve a last-known-good config when possible.

