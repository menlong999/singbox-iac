# Proposal

## Change ID

`broaden-local-ai-cli-compatibility`

## Why

The project is aimed at developers, and developer machines often already have local AI CLIs installed and authenticated. Requiring a dedicated cloud API key would add friction and work against the "small local tool" goal.

At the same time, the project should not grow a bespoke built-in adapter for every vendor. The better approach is:

- keep deterministic authoring as the default
- keep only a very small set of verified built-in providers
- make the generic exec adapter capable enough to integrate most local AI CLIs
- make doctor output explain which local tools are available and how they can be used

## What Changes

- classify more local AI tools by support level
- improve doctor output for local AI tooling discovery
- strengthen the exec provider contract for noisy stdout and file-based output
- document integration examples for common developer AI CLIs
- add regression tests for the generalized exec workflow

## Out of Scope

- hard-coding every vendor as a built-in provider
- adding cloud API based authoring
- letting AI CLIs write sing-box JSON directly
