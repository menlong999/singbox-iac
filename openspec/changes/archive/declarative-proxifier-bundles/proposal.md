# Proposal

## Change ID

`declarative-proxifier-bundles`

## Why

Process-aware routing is one of the project's strongest differentiators, but today it is still partially expressed as helper generation and documentation rather than a stable declarative product feature.

Developers need reusable process bundles for common tools such as:

- Antigravity
- Cursor
- VS Code
- Claude Code
- Gemini CLI
- Codex
- Copilot CLI

The project should define those bundles as structured specs and render artifacts from them, rather than treating them as ad-hoc examples.

## What Changes

- introduce `ProxifierBundleSpec`
- make `proxifier bundles` support `list`, `show`, and `render`
- define built-in developer bundle specs for common AI IDE and CLI tools
- let onboarding and natural-language authoring refer to those bundle specs directly
- keep generated Proxifier helper files aligned with the selected specs

## Out of Scope

- replacing Proxifier with in-tool process interception
- OS-specific packet capture or kernel extensions
- non-macOS process launch integration
