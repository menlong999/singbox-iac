# Design

## Preview Scope

`author --preview` should show three layers:

1. generated DSL rules
2. updated builder config
3. generated staging config

Preview is read-only. It must not modify:

- the rules file
- the builder config
- the staging config path
- any LaunchAgent

## Implementation

- Render rules with the same serializer used by the write path.
- Render builder-config changes by applying the same YAML-document mutation in memory.
- Build the staging config in a temporary directory using:
  - a temporary rules file
  - a temporary staging output path
- Diff current content vs proposed content with unified diffs.

## Output Shape

The command prints:

- summary lines
- provider requested/used
- notes
- `Rules diff`
- `Builder config diff`
- `Staging config diff`

If a section does not change, it should say so explicitly.

## Validation Strategy

1. CLI test proving preview does not write files
2. real smoke using the local authoring-smoke config and a deterministic prompt
