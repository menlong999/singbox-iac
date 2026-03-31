# Proposal: Publish First Release

## Why

The repository has passed release validation and the npm organization is ready. The first public package release should be published so users can install the CLI directly from npm.

## What Changes

- remove the final repository-side publish blocker (`private: true`)
- publish `@singbox-iac/cli@0.1.0` to npm with public access
- record the publish result and follow-up verification

## Non-Goals

- automating future version bumps or changelog generation
