# Proposal

## Change ID

`support-intent-first-authoring`

## Why

The project should not force users to understand the YAML DSL, prompt engineering, or sing-box internals for common developer routing needs.

For the main target audience, the desired interaction is:

- write one natural sentence
- let the tool infer service-specific rules
- let the tool update built-in group defaults when the request is category-level
- let the tool keep verification expectations aligned with the new intent

## What Changes

- extend natural-language authoring to emit group default overrides
- extend natural-language authoring to emit verification expectation overrides
- recognize more developer-oriented phrases such as:
  - `开发类都走香港`
  - `Antigravity 进程级走美国`
  - `Gemini 走新加坡`
- apply those changes through the normal `author -> build -> verify` pipeline

## Out of Scope

- free-form policy programming
- replacing Proxifier with in-tool process interception
- removing the DSL from the project
