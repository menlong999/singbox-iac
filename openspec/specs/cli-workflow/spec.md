# CLI Workflow

## Goal

Provide a user-friendly command-line interface for initialization, build, apply, update, diagnostics, and scheduling.

## Planned Commands

- `go`
- `use`
- `update`
- `init`
- `setup`
- `author`
- `build`
- `check`
- `apply`
- `run`
- `verify`
- `update`
- `doctor`
- `diagnose`
- `proxifier bundles`
- `proxifier scaffold`
- `schedule install`
- `schedule remove`

## Requirements

- `go` must provide the shortest first-run onboarding path by accepting a subscription URL and one routing sentence as positional arguments.
- `use` must provide the shortest everyday rule-change path by accepting one routing sentence and applying it without forcing the user to understand DSL syntax.
- `update` should auto-reload a running `sing-box` process when the configured reload target is already active.
- The CLI help output should make it clear that most users only need `go`, `use`, and `update`, while health/debug commands remain easy to discover and power-user commands do not dominate the first screen.
- `init` must generate example configuration assets for the user.
- `setup` must provide a power-user first-run path that can initialize the default config, prepare rule sets, and build a staging config when the user wants more control than `go`.
- `setup` should surface local environment readiness during onboarding unless the user explicitly skips it.
- `setup` should be able to run a guided activation path that includes verification and publish steps after a successful first build.
- `setup` should be able to continue into a foreground `sing-box` run after a successful onboarding flow.
- `setup` should be able to open isolated visible browser windows for representative verification URLs without requiring the user to configure a browser manually.
- `setup` should be able to narrow those visible verification URLs based on the user's natural-language routing prompt.
- `setup` should be able to generate Proxifier helper assets when the onboarding prompt implies process-aware routing intent.
- `author` must support intent-first rule authoring without requiring the user to understand the DSL.
- `author` must support preview-only operation.
- `author` may optionally trigger a closed-loop update flow after writing rules.
- `build` must generate config artifacts without applying them.
- `check` must validate a generated config artifact with `sing-box`.
- `apply` must validate and publish the latest generated artifact.
- `run` must support foreground execution of a generated config for manual testing.
- `verify` must support closed-loop validation of critical routing behavior with generated configs and real client traffic.
- `verify` must be able to consume user-journey scenarios from builder config, including inbound choice, target URL, and expected outbound selector or leaf.
- `update` must perform fetch, build, validation, and apply in one flow.
- `doctor` must surface environment gaps such as missing `sing-box`.
- `diagnose` must summarize runtime, listener, proxy, schedule, recent transaction, and best-effort DNS/network evidence in one command.
- `diagnose` should help distinguish local environment failures from runtime drift without claiming root cause with certainty.
- `proxifier bundles` must enumerate the supported process presets that can help users build Proxifier rules.
- `proxifier scaffold` must generate a helper directory from the configured `in-proxifier` listener and optional prompt-derived process bundles.
- Example and fallback listener defaults should avoid common Clash-family local ports to support side-by-side testing on macOS.
- The distributed CLI package must be installable from an npm tarball with a working `singbox-iac` binary entrypoint.
- Package metadata must restrict runtime contents to the compiled CLI and required docs/examples rather than shipping the whole workspace.
- Distribution readiness must be verifiable through a single repeatable repository command that exercises pack-and-install smoke validation.
- The repository must support a publish dry run through a staged package copy, so dry-run validation does not require mutating the main workspace metadata.
