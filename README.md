# Sing-box IaC Builder

Policy-first subscription compiler for `sing-box` on macOS.

`Sing-box IaC Builder` turns fragile proxy subscriptions into deterministic, verifiable `sing-box` infrastructure. It fetches provider subscriptions, parses share links into a normalized intermediate model, compiles them with a controlled routing policy, validates the generated configuration, and applies updates safely in a headless macOS environment.

This project is built for users who have outgrown GUI clients and template patch scripts:

- Subscriptions should provide nodes, not define your whole routing architecture.
- Route priority should be explicit and testable.
- Runtime updates should be validated before they touch the live config.
- `Proxifier`, multiple listeners, AI application routing, and custom rule sets should be first-class use cases.

## Why This Exists

Most GUI-centric workflows solve "import subscription", not "manage proxy infrastructure".

Typical pain points:

- Large provider groups with poor or unstable region segmentation
- Template- or JavaScript-based patching that breaks whenever the upstream subscription changes
- Opaque config merge behavior and hard-to-debug rule precedence issues
- High resource usage from GUI shells that should not be involved in a headless proxy runtime
- Weak support for process-aware routing, `Proxifier`, and application-specific AI egress policies

`Sing-box IaC Builder` treats `sing-box` as infrastructure:

- `subscription -> parser -> compiler -> check -> publish -> reload`
- Deterministic route ordering
- Human-friendly rule authoring
- Safe rollout with staging and validation
- macOS-first headless operation via `launchd`

## Positioning

This is not:

- another GUI client
- an online converter
- a one-off template filler
- a generic multi-client subscription merger

This is:

- a `sing-box` configuration compiler
- a runtime-safe CLI for headless macOS setups
- a policy-first abstraction over fragile provider subscriptions
- a foundation for future natural-language rule authoring

## How It Differs

| Dimension | Subscription Converters | GUI Clients / Launchers | Sing-box IaC Builder |
| --- | --- | --- | --- |
| Core goal | Convert one config format into another | Provide visual client UX | Compile subscriptions into managed `sing-box` infrastructure |
| Policy control | Often template-driven | Often merged inside the client | Explicit compiler-controlled route policy |
| Rule priority | Easy to drift with upstream changes | Often opaque | Fixed ordering and testable behavior |
| Runtime safety | Usually writes output only | Apply path is often hidden | `build -> check -> publish -> reload` |
| macOS headless | Usually not a focus | Usually not a focus | First-class |
| `Proxifier` / multi-listener | Rarely central | Awkward to maintain | Core scenario |
| AI app routing | Usually manual | Possible but brittle | Policy-level capability |
| User customization | Template edits / scripts | GUI clicks / raw config edits | Declarative DSL, later NL-to-DSL |

## Implemented Today

The current repository is already beyond Phase 0. It includes:

- Base64 Trojan subscription fetching and parsing
- `sing-box` config compilation with fixed route ordering
- runtime-safe commands: `build`, `check`, `apply`, `run`, `verify`, `update`
- config-driven route verification with real `sing-box` and headless Chrome
- simple YAML user-rules DSL with protected insertion points
- built-in rule templates for common developer and video-site patterns
- natural-language authoring that generates DSL, builds config, can install `launchd`, and can optionally probe local AI CLIs
- one-step setup via `setup`
- macOS helper commands: `init`, `doctor`, `schedule install`, `schedule remove`

## Install

The package is now published on npm as:

```bash
npm install -g @singbox-iac/cli
singbox-iac --help
```

The shortest first-run path is now:

```bash
singbox-iac setup \
  --subscription-url '你的机场订阅地址' \
  --prompt 'GitHub 这类开发类走香港，Antigravity 进程级走美国，Gemini 走新加坡，每30分钟自动更新'

singbox-iac run
```

After that, day-to-day usage is usually just:

```bash
singbox-iac update --reload
```

For local dogfooding today, the CLI can already be installed from a packed tarball:

```bash
npm pack
npm install -g ./singbox-iac-cli-0.1.0.tgz
singbox-iac --help
```

For repository-based installs during development:

```bash
npm install
npm run build
npx singbox-iac --help
```

The package name is now aligned to the published public scope. The distribution shape is ready for ongoing npm publishing:

- Node shebang on the compiled CLI entrypoint
- `dist`-only package contents plus docs/examples
- `prepare` and `prepack` build hooks
- `bin` and `exports` metadata

For a full repeatable distribution smoke, run:

```bash
npm run release:check
```

That command executes:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm pack`
- clean-directory install smoke with `singbox-iac --help`

On success it cleans up the tarball and temp install directory. On failure it keeps them for debugging.

For a publish-level dry run without mutating the main workspace metadata:

```bash
npm run release:dry-run
```

That command stages a temporary publishable package copy and runs `npm publish --dry-run`. You can also test an alternate future package name without editing `package.json`:

```bash
SINGBOX_IAC_PACKAGE_NAME=@singbox-iac/experimental-cli npm run release:dry-run
```

Detailed publish notes are in [Releasing](/Users/lvyuanfang/Code/SingBoxConfig/docs/releasing.md).

## Recommended First Run

If you are installing from npm for the first time, use `setup` rather than manually chaining `init`, ruleset downloads, and `build`.

What `setup` does:

- creates `~/.config/singbox-iac/builder.config.yaml` if needed
- creates `~/.config/singbox-iac/rules/custom.rules.yaml`
- downloads the default local `.srs` rule sets
- optionally turns one natural-language sentence into routing rules
- builds `~/.config/singbox-iac/generated/config.staging.json`

Examples:

```bash
singbox-iac setup --subscription-url '你的机场订阅地址'
```

```bash
singbox-iac setup \
  --subscription-url '你的机场订阅地址' \
  --prompt 'Google 服务和 GitHub 走香港，Gemini 走新加坡，Antigravity 进程级走美国'
```

Then:

```bash
singbox-iac run
```

If you want periodic background updates:

```bash
singbox-iac schedule install
```

## Planned CLI

```bash
singbox-iac init
singbox-iac setup
singbox-iac author
singbox-iac build
singbox-iac apply
singbox-iac update
singbox-iac doctor
singbox-iac schedule install
singbox-iac schedule remove
singbox-iac templates list
```

## Project Status

The project is currently at a usable MVP-plus stage:

- real subscription ingestion works
- real route verification works
- real publish flow works
- simple rule DSL works
- macOS launchd integration is available

The highest-value remaining areas are:

- more protocol support beyond Trojan
- release automation beyond the current manual `npm publish`

## Authoring Shortcuts

For day-to-day usage, the practical authoring stack is:

- built-in policy for protected routes
- Proxifier for process-aware IDE and app routing
- built-in templates for common developer and video-site rules
- natural-language prompts for fast generation
- YAML DSL only for small exceptions

Docs:

- [Rules DSL](/Users/lvyuanfang/Code/SingBoxConfig/docs/rules-dsl.md)
- [Rule Templates](/Users/lvyuanfang/Code/SingBoxConfig/docs/rule-templates.md)
- [Natural-Language Authoring](/Users/lvyuanfang/Code/SingBoxConfig/docs/natural-language-authoring.md)

## Local AI CLI Support

This project does not require API keys for authoring.

The recommended flow is:

- default to deterministic local authoring
- optionally probe a local AI CLI with `provider=auto`
- optionally integrate any other CLI through `provider=exec`
- use `author --preview` before writing when changing prompts or providers
- always validate and compile through the same DSL and `sing-box` pipeline

Current support model:

- built-in provider:
  - `claude`
- generic `exec` integrations:
  - `gemini`
  - `codebuddy`
  - `codex`
  - `opencode`
  - `qodercli` / `qoder`
- tooling-only detection:
  - `trae`

The project should not hard-code every AI CLI vendor. Instead:

- keep one or two verified built-ins
- support broad developer tooling through `provider=exec`
- allow wrapper scripts for CLIs with noisy or event-stream output

The `exec` adapter already supports:

- `{{prompt}}`
- `{{schema}}`
- `{{context_json}}`
- `{{full_prompt}}`
- `{{schema_file}}`
- `{{output_file}}`

and will accept:

- exact JSON stdout
- fenced JSON blocks
- a balanced JSON object extracted from longer text
- output written to `{{output_file}}`

This is the compatibility layer that makes “support most AI CLIs” practical without turning the project into a vendor-specific adapter zoo.

Natural-language authoring is now intent-first for common developer use cases. The user does not need to know the DSL or internal selector names for routine requests such as:

- `GitHub 这类开发类都走香港出口`
- `Antigravity 进程级都走独立入口并路由到美国节点`
- `Gemini 都出口到新加坡`

The authoring layer can compile those sentences into:

- explicit site rules
- selector default changes
- verification expectation updates

so the normal `author -> build -> verify` pipeline still stays consistent.

It also understands more mainstream subscription vocabulary, for example:

- `Google 服务和 GitHub 这类开发类都走香港`
- `Apple 服务走香港`
- `Amazon Prime 和 Apple TV 走新加坡`
- `视频网站走美国`

And it can now go all the way to publish from one sentence:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config ./builder.config.local.yaml \
  --provider deterministic \
  --prompt "Google 服务和 GitHub 这类开发类都走香港，Gemini 走新加坡，Antigravity 进程级走美国，每30分钟自动更新" \
  --update
```

See:

- [Natural-Language Authoring](/Users/lvyuanfang/Code/SingBoxConfig/docs/natural-language-authoring.md)

## References

- [OpenSpec](https://openspec.pro/)
- [sing-box documentation](https://sing-box.sagernet.org/configuration/)
- [sing-box migration guide](https://sing-box.sagernet.org/migration/)
