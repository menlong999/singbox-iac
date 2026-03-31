# Proposal: Prepare npm Distribution

## Why

The project is already usable as a source checkout, but the intended product experience is `npm`-first. The CLI package should be installable from a packed tarball today, and later publishable to npm with minimal additional work.

## What Changes

- add a Node shebang to the CLI entrypoint so npm-installed binaries execute directly
- tighten package metadata for runtime distribution
- ensure package build hooks produce fresh `dist` artifacts before packing
- document the current install path and publish prerequisites
- verify the package with a real `npm pack -> npm install -> singbox-iac --help` smoke test

## Non-Goals

- selecting the final public npm package name
- choosing an open-source license
- automating npm publish itself
