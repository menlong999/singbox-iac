# Rule Authoring

## Goal

Allow users to customize routing intent with a compact YAML DSL instead of raw sing-box JSON.

## Requirements

- The DSL must be YAML-based and easy to hand-edit.
- The DSL must support explicit insertion points relative to built-in routing behavior.
- The project must provide a small catalog of built-in rule templates for common developer and video-site use cases.
- The project must provide a first-class built-in site bundle registry so common product names can resolve to maintained official-rule-set-backed or curated domain matchers.
- The project must provide a refreshable official rule-set catalog sourced from upstream `sing-geosite` and `sing-geoip` rule-set branches.
- The project must provide maintained built-in process bundle metadata so common developer and AI tools can resolve to reusable process matchers.
- Mainstream service vocabulary such as Google services, Apple services, Netflix, Amazon Prime Video, Apple TV, and common developer-site classes should map cleanly to authoring intent.
- Natural-language authoring should resolve recognized product names through the built-in site and process bundle registries before falling back to ad-hoc explicit domains or generic process notes.
- The project must support natural-language authoring that generates the DSL instead of mutating sing-box JSON directly.
- Natural-language authoring must support a reliable deterministic mode with no API dependency.
- Natural-language authoring may optionally use local AI CLIs, but it must be able to fall back safely when those CLIs are unavailable or unusable.
- Local AI CLI integrations should be broad through a generic exec adapter instead of requiring one built-in provider per vendor.
- The generic exec adapter must support prompt/schema/context placeholders, schema and output temp files, and extraction of a JSON plan from noisy text output.
- Natural-language authoring should support intent-first developer sentences without requiring users to understand the DSL or internal selector names.
- Natural-language authoring may update selector defaults and verification expectations when a prompt expresses category-level or scenario-specific routing intent.
- Natural-language authoring must persist a stable layered authoring state separate from the generated DSL so additive prompt updates can preserve earlier intent.
- The layered authoring state may store prompt-derived authoring plans, but it must still produce a merged effective intent for preview, build, verification, and status flows.
- The DSL must support common matchers:
  - `inbound`
  - `protocol`
  - `network`
  - `port`
  - `domain`
  - `domainSuffix`
  - `ruleSet`
- The DSL must support simple actions:
  - `route` to an existing outbound or selector
  - `reject`
- The compiler must reject invalid rule targets instead of silently ignoring them.
- Missing user-rules files must not fail the build; they should surface as warnings.
- User rules must not be able to insert ahead of protected system invariants.
- Natural-language authoring may update the builder config to point at the generated rules file and to set schedule metadata.
- Everyday `use` flows must default to patch semantics so a new prompt augments or overrides relevant intent without erasing unrelated prior authoring.
- `use --replace` must remain available for explicit full replacement of the authored policy set.
- Schedule installation must remain an explicit action even when a prompt contains interval language.
- Local AI CLI integrations must be bounded to DSL-plan generation and must not write raw sing-box JSON directly.
- Site bundles should prefer configured official rule-set tags when they are available and fall back to maintained exact domains and domain suffixes when they are not.

## Insertion Points

- `beforeBuiltins`
  Insert after protected system rules and before built-in service rules.
- `afterBuiltins`
  Insert after built-in service rules and before China-direct rules.

## Template Categories

- developer third-party AI sites
- developer common tooling sites
- region-oriented video-site bundles
- mainland direct video-site bundles

## Bundle Discovery

- site bundles should include canonical product names and suggested verification URLs
- site bundles should include preferred official rule-set tags when upstream coverage exists
- site bundles should still retain curated fallback exact domains and domain suffixes for products without official tags or for configs that have not enabled those tags yet
- process bundles should include reusable process matchers and prompt-discovery aliases
