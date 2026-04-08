# Proposal: use-conflict-averse-default-ports

## Why

The local MVP now supports `build`, `check`, `apply`, and `run`, but its default listener ports still overlap with ports commonly used by Clash-based desktop clients. That makes side-by-side browser testing awkward and increases the chance of accidental conflicts while the user is still dogfooding the generated `sing-box` config.

## What Changes

- change example and local default listeners to high ports
- change CLI fallback defaults to the same port pair
- add validation coverage so generated configs keep these defaults unless explicitly overridden

## Impact

- safer parallel testing with an existing Clash Verge setup
- no change to route behavior or node compilation
