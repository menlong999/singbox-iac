# Change Proposal: add-check-reload-manager

## Summary

Implement validation, publish, reload, and scheduling for generated `sing-box` configs.

## Scope

- run `sing-box check`
- publish staging configs to the live path
- keep a last-known-good backup
- reload `sing-box`
- add `launchd` scheduling support

