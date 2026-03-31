# Proposal: Add Release Dry-Run and License

## Why

The repository can now be packed and locally installed, but public release preparation still lacks two essentials:

- an explicit open-source license
- a safe way to exercise `npm publish --dry-run` without mutating committed package metadata

## What Changes

- add an MIT license file and package metadata
- add a `release:dry-run` script
- stage a temporary publishable package copy with `private: false`
- allow testing a candidate future package name through an environment override
- document the release path and naming guidance

## Non-Goals

- selecting the final public npm package name
- performing a real publish
