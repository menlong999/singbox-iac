# Natural-Language Authoring

The `author` command is the bridge between a short routing prompt and the full local workflow:

1. turn a prompt into the YAML rules DSL
2. write the generated rules file
3. update the builder config to point at that rules file
4. build a new `sing-box` config
5. optionally install a `launchd` schedule that runs `update`
6. optionally run `update` immediately from the same command

The output still goes through the normal compiler pipeline. Natural language does not mutate `sing-box` JSON directly.

## Layered Authoring Semantics

There are now two user-facing authoring modes:

- `use '<prompt>'`
  Patch the current authored policy set by default. A new prompt should preserve unrelated earlier intent.
- `use '<prompt>' --replace`
  Explicitly rebuild the authored policy set from this prompt.
- `author --prompt '<prompt>'`
  Remains the advanced authoring entrypoint and still behaves like an explicit replacement unless a caller opts into patch mode internally.

Internally, the workflow now keeps two artifacts next to each other:

- the generated YAML DSL at `rules.userRulesFile`
- a sibling `*.authoring.yaml` file that stores the stable layered authored state

The compiler still consumes the merged result. The layered state exists so `use` can remain additive over time without losing earlier authoring intent.

## Provider Modes

The authoring layer supports four provider modes:

- `deterministic`
  The built-in keyword/template parser. This is the default because it is fast, testable, and does not depend on any external model.

- `auto`
  Try a supported local AI CLI first, then fall back to the deterministic parser if the local CLI is unavailable, times out, or returns invalid output.

- `claude`
  Use the local `claude` CLI directly for structured JSON plan generation.

- `exec`
  Use any local command that can print a JSON authoring plan to stdout or write one to a file.

Recommended default:

```yaml
authoring:
  provider: "deterministic"
  timeoutMs: 4000
```

Opt in to local AI CLI probing:

```yaml
authoring:
  provider: "auto"
  timeoutMs: 1000
```

## One-Line Examples

Generate rules and build a staging config:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config ./builder.config.local.yaml \
  --prompt "开发者网站走香港，视频网站走新加坡"
```

Patch the existing authored policy with one sentence:

```bash
./node_modules/.bin/tsx src/cli/index.ts use \
  'Gemini 走新加坡'
```

Force a full replacement instead of patching:

```bash
./node_modules/.bin/tsx src/cli/index.ts use \
  'Google 服务和 GitHub 都走新加坡' \
  --replace
```

Preview what would change without writing files:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config ./builder.config.local.yaml \
  --provider deterministic \
  --prompt "OpenRouter 走香港，YouTube Netflix 走美国，每60分钟自动更新" \
  --preview
```

Generate rules, build a config, and install a schedule:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config ./builder.config.local.yaml \
  --prompt "OpenRouter 和 Perplexity 走香港，YouTube Netflix 走美国，每45分钟自动更新" \
  --install-schedule
```

Generate rules and immediately run `build -> verify -> publish`:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config ./builder.config.local.yaml \
  --provider deterministic \
  --prompt "Google 服务和 GitHub 这类开发类都走香港，Gemini 走新加坡，Antigravity 进程级走美国，每30分钟自动更新" \
  --update
```

Force a local AI CLI attempt first, then fall back safely if needed:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config ./builder.config.local.yaml \
  --provider auto \
  --author-timeout-ms 1000 \
  --prompt "开发者网站走香港，AI 工具走香港，视频网站走新加坡，每45分钟自动更新"
```

Use a local subscription fixture instead of fetching remotely:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config ./builder.config.local.yaml \
  --prompt "国内视频网站直连，AI 工具走香港，每2小时自动更新" \
  --subscription-file ./tests/fixtures/subscriptions/trojan-sample.b64 \
  --install-schedule \
  --no-load
```

## What the Prompt Can Express

This layer intentionally aims at simple intent, not full policy programming.

It works best for:

- process-aware reminders like `IDE 走 proxifier`
- site classes like `视频网站走美国`
- named products like `Google Stitch 走美国`
- named site bundles like `NotebookLM 走美国`
- named process bundles like `Cursor 走独立入口` or `Codex 走独立入口`
- short regional intents like `OpenRouter 走香港`
- schedule phrases like `每45分钟自动更新`
- one-sentence developer routing like `GitHub 这类开发类走香港，Antigravity 进程级走美国，Gemini 走新加坡`
- mainstream subscription vocabulary like `Google 服务`, `Apple 服务`, `Amazon Prime`, `Apple TV`

## Intent-First Behavior

The `author` command does not require the user to think in DSL terms.

For common developer sentences, it now compiles intent across three layers:

1. specific site overrides
   Example: `Gemini 走新加坡` becomes an explicit rule before built-ins.
2. selector default changes
   Example: `开发类都走香港` updates `Dev-Common-Out` to default to `HK`.
3. verification expectation alignment
   Example: if the configured verification URL for Gemini previously expected `AI-Out -> HK`, it will be updated so runtime verification now expects `SG`.

That keeps `author -> build -> verify` truthful even after intent-driven changes.

Example:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config ./builder.config.local.yaml \
  --provider deterministic \
  --prompt "GitHub 这类开发类都走香港出口，Antigravity 进程级都走独立的入口并路由到美国节点，Gemini 都出口到新加坡，每30分钟自动更新"
```

Common category-style examples:

- `Google 服务和 GitHub 这类开发类都走香港`
- `Apple 服务走香港`
- `Amazon Prime 和 Apple TV 走新加坡`
- `视频网站走美国`

## Built-In Bundle Discovery

The built-in registry is now the primary discovery layer for common products.

Examples:

- site bundles
  - `NotebookLM`
  - `Gemini`
  - `ChatGPT`
  - `OpenRouter`
  - `Google Stitch`
- process bundles
  - `Antigravity`
  - `Cursor`
  - `VS Code`
  - `Claude Code`
  - `Gemini CLI`
  - `Codex`
  - `Copilot CLI`

When a prompt mentions one of these products, the authoring layer resolves it through the maintained bundle registry before falling back to ad-hoc explicit domains.

Examples:

```bash
./node_modules/.bin/tsx src/cli/index.ts use \
  'NotebookLM 走美国'
```

```bash
./node_modules/.bin/tsx src/cli/index.ts use \
  'Antigravity 进程级走美国，GitHub 走香港'
```

Supported schedule phrases include:

- `每30分钟`
- `每45分钟`
- `每2小时`
- `schedule`
- `launchd`

## Output Model

Natural language produces three things:

- generated user rules
- optional inferred templates
- optional schedule interval
- optional selector default changes
- optional verification expectation overrides

When layered authoring is active, those prompt outputs are merged with the current authored base before the DSL and builder config are rewritten.

The command then updates:

- `rules.userRulesFile`
- `schedule.enabled`
- `schedule.intervalMinutes`
- selector defaults such as `AI-Out`, `Dev-Common-Out`, or `Process-Proxy`
- verification scenario expectations when an existing scenario’s target intent changed

and, when using natural-language authoring, also persists a sibling `*.authoring.yaml` state file so future `use` calls can patch instead of replacing the whole authored policy set.

and writes a new staging config.

With `--preview`, the command does not write anything. Instead it prints:

- Intent IR diff
- rules diff
- builder config diff
- staging config diff

This is the safest way to inspect what a prompt or local AI CLI would change before touching your local files.

## Audit-Friendly Flags

Use these flags when you want stronger control over one-sentence authoring:

- `--strict`
  Reject vague language instead of guessing. This is recommended for production changes.
- `--diff`
  Print the `IntentIR` diff, rules diff, builder config diff, and staging config diff without writing files.
- `--emit-intent-ir`
  Print the generated `IntentIR` JSON and exit without touching local files.

Examples:

```bash
./node_modules/.bin/tsx src/cli/index.ts use \
  'GitHub 这类开发类都走香港，Gemini 走新加坡' \
  --strict --diff
```

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config ./builder.config.local.yaml \
  --prompt 'OpenRouter 走香港' \
  --emit-intent-ir
```

In strict mode, the command rejects prompts like:

- `快一点`
- `大部分`
- `差不多`
- `AI 都走好一点的节点`

Those phrases are too vague to compile into a stable routing policy.

## Exec Provider

The `exec` provider is the escape hatch for developer machines that already have local AI tooling.
This is the recommended way to integrate most AI CLIs beyond the built-in `claude` adapter.

The command receives:

- `SINGBOX_IAC_AUTHOR_PROMPT`
- `SINGBOX_IAC_AUTHOR_SCHEMA`
- `SINGBOX_IAC_AUTHOR_CONTEXT`

Arguments may use placeholders:

- `{{prompt}}`
- `{{schema}}`
- `{{context_json}}`
- `{{full_prompt}}`
- `{{schema_file}}`
- `{{output_file}}`

Environment variables are also injected for wrapper scripts:

- `SINGBOX_IAC_AUTHOR_PROMPT`
- `SINGBOX_IAC_AUTHOR_SCHEMA`
- `SINGBOX_IAC_AUTHOR_CONTEXT`
- `SINGBOX_IAC_AUTHOR_FULL_PROMPT`
- `SINGBOX_IAC_AUTHOR_SCHEMA_FILE`
- `SINGBOX_IAC_AUTHOR_OUTPUT_FILE`

The command must print a JSON object that matches the internal plan schema:

```json
{
  "templateIds": ["developer-ai-sites", "video-sg"],
  "beforeBuiltins": [],
  "afterBuiltins": [],
  "notes": [],
  "scheduleIntervalMinutes": 45
}
```

If the CLI is noisy, the provider will also accept:

- a fenced ````json` block that contains the plan
- a longer text response with one balanced JSON object inside it
- an output file path populated through `{{output_file}}`

## Common Local AI CLI Integrations

The goal is not to hard-code every AI CLI on the market. The goal is to make almost all of them usable through one bounded adapter.

Recommended support model:

- stable built-ins:
  - `claude`
- generic `exec` integrations:
  - `gemini`
  - `codebuddy`
  - `codex`
  - `opencode`
  - `qodercli` / `qoder`
- tooling-only or editor launchers:
  - `trae`

### Gemini CLI

Best when Gemini is already logged in locally and you want a lightweight prompt-only integration.

```yaml
authoring:
  provider: "exec"
  timeoutMs: 4000
  exec:
    command: "gemini"
    args:
      - "-p"
      - "{{full_prompt}}"
```

### CodeBuddy CLI

`codebuddy` and `cbc` expose `--print` and `--output-format json`, which makes them strong `exec` candidates.

```yaml
authoring:
  provider: "exec"
  timeoutMs: 4000
  exec:
    command: "codebuddy"
    args:
      - "--print"
      - "--output-format"
      - "json"
      - "{{full_prompt}}"
```

### Codex CLI

Codex already supports schema files and writing the final response to a file. That maps well onto `{{schema_file}}` and `{{output_file}}`.

```yaml
authoring:
  provider: "exec"
  timeoutMs: 8000
  exec:
    command: "codex"
    args:
      - "exec"
      - "--skip-git-repo-check"
      - "--output-schema"
      - "{{schema_file}}"
      - "--output-last-message"
      - "{{output_file}}"
      - "{{full_prompt}}"
```

### OpenCode

`opencode run` supports a non-interactive message flow and a JSON event mode. Use a small wrapper if the raw JSON event stream is too noisy.

```yaml
authoring:
  provider: "exec"
  timeoutMs: 8000
  exec:
    command: "opencode"
    args:
      - "run"
      - "--format"
      - "json"
      - "{{full_prompt}}"
```

### Qoder CLI

If Qoder is installed locally, prefer a wrapper script or a direct print/json mode if your local version exposes one.

```yaml
authoring:
  provider: "exec"
  timeoutMs: 8000
  exec:
    command: "qodercli"
    args:
      - "--print"
      - "--output-format"
      - "json"
      - "{{full_prompt}}"
```

### Wrapper Pattern

Some CLIs will not print the exact JSON plan directly. In that case, use a tiny local wrapper script.

```yaml
authoring:
  provider: "exec"
  timeoutMs: 8000
  exec:
    command: "/Users/you/bin/singbox-author-wrapper"
    args:
      - "{{prompt}}"
      - "{{output_file}}"
      - "{{schema_file}}"
```

That wrapper can:

1. call the local AI CLI you prefer
2. instruct it to output only one JSON plan
3. write the final JSON object to `{{output_file}}`

This keeps the project neutral and avoids shipping hard-coded adapters for every vendor.

## Guardrails

- Built-in protected system rules still stay first.
- Generated rules still pass through the DSL validator.
- Schedule installation is explicit through `--install-schedule`.
- If a clause maps better to the built-in proxifier flow, the generator emits a note rather than trying to fake process matching inside the DSL.
- `auto` may fall back to deterministic if a local AI CLI is installed but not usable in the current environment.

## Recommended Usage

For developer-oriented setups, use this workflow:

1. keep `Process-Proxy` reserved for Proxifier-driven IDE and app traffic
2. use built-in service rules for Stitch, OpenAI, Gemini, Anthropic, GitHub, and Google
3. use templates or natural language for third-party AI sites and video sites
4. use the DSL only for small exceptions
