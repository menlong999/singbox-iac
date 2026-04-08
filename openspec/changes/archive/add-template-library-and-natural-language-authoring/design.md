# Design

## Template Layer

Templates remain ordinary DSL rule fragments. They are grouped into a small catalog and merged before prompt-generated rules:

- `developer-ai-sites`
- `developer-common-sites`
- `video-us`
- `video-hk`
- `video-sg`
- `video-jp`
- `cn-video-direct`

This keeps templates transparent. There is no separate runtime path for template rules.

## Natural-Language Model

The natural-language layer is intentionally shallow:

- normalize a prompt
- split it into short clauses
- infer a route target from each clause
- map common phrases to templates or explicit domain bundles
- infer a schedule interval when the prompt contains time language

The output is still:

- `beforeBuiltins`
- `afterBuiltins`
- `templateIds`
- `notes`
- optional `scheduleIntervalMinutes`

## Safety Model

- Natural language never writes raw sing-box JSON.
- Generated rules still flow through the DSL validator.
- `author` updates `rules.userRulesFile` and schedule metadata in the builder config.
- Installing a `launchd` schedule remains explicit via `--install-schedule`.

## Repeated Authoring

Natural-language authoring is expected to be iterative, so schedule installation must support replacement of an existing LaunchAgent. The `author` command exposes `--force-schedule` and forwards it to the existing launchd installer.

## Validation Strategy

1. unit tests for template selection and prompt parsing
2. CLI tests for `author`
3. real-subscription smoke:
   - `templates list`
   - `author`
   - `verify`
   - `update`
   - `plutil -lint`
