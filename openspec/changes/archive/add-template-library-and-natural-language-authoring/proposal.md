# Proposal: Add Template Library And Natural-Language Authoring

## Why

The simple DSL is already useful, but developers still need to write YAML for the most common cases:

- third-party AI sites
- common developer tooling sites
- region-specific video-site routing
- "generate the rules for me and set the update schedule"

For day-to-day use, the authoring surface should be:

- built-in policy
- Proxifier for process-aware flows
- templates for common site classes
- natural language for quick generation
- raw DSL only for exceptions

## What Changes

- Add a catalog of reusable rule templates for developer and video-site routing.
- Add a natural-language module that maps simple prompts into DSL rules, inferred templates, and optional schedule intervals.
- Add CLI entrypoints:
  - `templates list`
  - `templates show`
  - `author`
- Allow `author` to:
  - write the generated rules file
  - update the builder config
  - build a staging config
  - optionally install a `launchd` schedule

## Impact

- Common developer workflows need less manual DSL authoring.
- The project gets a practical authoring layer without sacrificing validation or compiler invariants.
- Real subscription smoke tests can now prove the full path from prompt to staged config and schedule artifact.
