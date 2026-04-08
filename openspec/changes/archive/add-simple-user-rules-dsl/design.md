# Design

## DSL Shape

The DSL is a small YAML document:

```yaml
version: 1

beforeBuiltins:
  - name: "OpenRouter uses AI"
    domainSuffix: "openrouter.ai"
    route: "AI-Out"

afterBuiltins:
  - name: "Reject a specific UDP path"
    inbound: "in-mixed"
    network: "udp"
    port: 443
    action: "reject"
```

## Why This Shape

- It removes the extra `match:` and `action:` nesting from earlier sketches.
- It preserves readability for hand-authored files.
- It keeps the insertion model obvious and limited.

## Supported Matchers

- `inbound`
- `protocol`
- `network`
- `port`
- `domain`
- `domainSuffix`
- `ruleSet`

## Supported Actions

- `route`
- `action: reject`

## Validation Rules

- Each rule must define at least one matcher.
- Each rule must define exactly one action.
- `route` targets must resolve to existing outbounds or selector tags.
- `ruleSet` tags must be configured and active.

## Compiler Insertion Order

1. Protected system rules
2. `beforeBuiltins`
3. Built-in Stitch / OpenAI / AI / developer rules
4. `afterBuiltins`
5. China direct rules

This keeps the original PRD invariants intact while giving users an explicit and understandable customization surface.
