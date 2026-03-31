# sing-box Compiler

## Goal

Compile normalized nodes and policy inputs into a complete `sing-box` configuration.

## Requirements

- The compiler must combine a static base template with dynamic outbounds.
- The compiler must generate policy groups such as `selector` or `urltest`.
- The compiler must support additional policy groups for AI, developer/common services, and dedicated special-case routes.
- The compiler must preserve explicit route ordering invariants.
- The compiler must emit a complete JSON config artifact.
- The compiler must support external rule-set references.
- The compiler must emit a DNS section and route resolver settings that are usable by current `sing-box` releases, including a non-empty default domain resolver for outbound dialing.

## Output Guarantees

- Config output must be deterministic for the same ordered inputs.
- Generated configs must be suitable for `sing-box check`.
