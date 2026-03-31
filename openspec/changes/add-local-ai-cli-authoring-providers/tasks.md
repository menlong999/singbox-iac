## Tasks

- [x] Add an authoring-provider abstraction with deterministic, auto, claude, and exec modes.
- [x] Add builder-config support for authoring provider settings.
- [x] Extend the `author` command with provider selection and exec-provider arguments.
- [x] Detect local AI CLIs in `doctor`.
- [x] Ensure auto provider times out and falls back safely instead of hanging the whole author flow.
- [x] Add unit tests for deterministic, exec, and auto-fallback behavior.
- [x] Update docs and examples for local AI CLI usage.
- [x] Run `typecheck`, `lint`, `test`, and a real local-environment smoke for `provider=auto`.
- [x] Record validation results and mark tasks complete.
