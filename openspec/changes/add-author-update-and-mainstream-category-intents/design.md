# Design

## Intent Coverage

Common subscription and routing language should map cleanly to either:

- explicit domain rules
- reusable templates
- selector default changes

The change therefore expands both:

- template coverage for mainstream streaming services
- alias coverage for Apple and Google ecosystem phrases

## Author-One-Step Flow

The `author` command should remain the natural front door for:

- deterministic authoring
- local AI CLI authoring
- preview
- optional schedule install

This change adds an explicit `--update` mode so users can go from one sentence to a verified live config without switching commands.

## Verification Guardrail

Intent-derived verification overrides must default to `in-mixed` unless the intent explicitly refers to process-aware routing.

This prevents general site phrases such as `Google 服务走香港` from weakening protected `in-proxifier -> Process-Proxy` expectations.
