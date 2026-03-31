# Rules DSL

## Design Goal

Users should customize routing intent without editing raw `sing-box` JSON.

## Layers

### Layer 1: Built-in system rules

These are protected invariants controlled by the compiler, such as:

- QUIC kill-switch for `udp:443`
- DNS handling
- `in-proxifier` high-priority routing

These rules always stay ahead of user rules.

### Layer 2: Declarative user rules

Users write a small YAML DSL with only two insertion points:

- `beforeBuiltins`
  Inserted after protected system rules and before built-in service rules such as Stitch, OpenAI, AI rule sets, and developer rule sets.
- `afterBuiltins`
  Inserted after built-in service rules and before China direct rules.

## File Shape

```yaml
version: 1

beforeBuiltins:
  - name: "OpenRouter uses AI"
    domainSuffix:
      - "openrouter.ai"
    route: "AI-Out"

afterBuiltins:
  - name: "Example mainland domain stays direct"
    domainSuffix:
      - "intranet.example.cn"
    route: "direct"
```

## Supported Matchers

Each rule may use one or more of these fields:

- `inbound`
- `protocol`
- `network`
- `port`
- `domain`
- `domainSuffix`
- `ruleSet`

Scalar values are allowed for convenience. These are normalized to arrays where needed.

## Supported Actions

- `route: "<outbound-or-group-tag>"`
- `action: "reject"`

Examples:

```yaml
version: 1

beforeBuiltins:
  - name: "OpenRouter uses the AI selector"
    domainSuffix: "openrouter.ai"
    route: "AI-Out"

  - name: "Block a specific UDP port"
    inbound: "in-mixed"
    network: "udp"
    port: 443
    action: "reject"
```

## Guardrails

- Every rule must define at least one matcher.
- Every rule must define exactly one action.
- Route targets must refer to an existing outbound or selector such as `AI-Out`, `HK`, `US`, `direct`, or `Global`.
- `ruleSet` matchers must refer to configured and active rule-set tags.
- User rules cannot be inserted ahead of protected system rules.

## Layer 3: Natural language to DSL

Natural-language authoring is now implemented as a separate front door. It still follows the same safety model:

- prompt -> generated DSL
- generated DSL -> validated user rules
- validated user rules -> compiled `sing-box` config
- optional schedule install only when explicitly requested

See:

- `/Users/lvyuanfang/Code/SingBoxConfig/docs/natural-language-authoring.md`
- `/Users/lvyuanfang/Code/SingBoxConfig/docs/rule-templates.md`

## Non-Goals for v1

- direct natural-language writes to live config
- arbitrary raw JSON mutation
