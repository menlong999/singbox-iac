# Design

The built-in registry should remain the primary source of truth.

## Site Bundle Registry

Each site bundle should describe:

- canonical product name
- related domain suffixes
- suggested verification URLs
- optional category tags

Initial candidates:

- NotebookLM
- Gemini
- OpenAI / ChatGPT
- Anthropic / Claude
- GitHub
- Google Stitch
- common streaming bundles already implied by template rules

## Process Bundle Registry

The existing proxifier bundle work should be extended, not replaced.

Priority bundles:

- Antigravity
- Cursor
- VS Code
- Claude Code
- Gemini CLI
- Codex
- Copilot CLI

## AI Assistance

Local AI CLI assistance may propose new related domains or process names, but proposed expansions must remain visible through diff/preview before they become durable state.
