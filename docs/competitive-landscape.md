# Competitive Landscape

## Existing Categories

### Generic subscription converters

These tools convert provider subscriptions into one or more target client formats. They are useful, but their center of gravity is format conversion, not runtime-safe policy compilation.

Typical limitations:

- route precedence is often inherited from templates
- process-aware routing is not a first-class use case
- runtime validation and staged publish are usually outside scope

### GUI clients and launchers

These tools optimize for usability and visual management. They are convenient but tend to hide merge order, effective config structure, and runtime rollout details.

Typical limitations:

- higher idle resource usage
- config merge logic is harder to audit
- process routing and custom listeners become brittle over time

### Library-style generators

These projects expose config generation as an SDK or library. They can be useful implementation references but are not the final product shape targeted here.

Typical limitations:

- not macOS workflow-oriented
- no opinionated CLI lifecycle
- no declarative policy authoring model

## Planned Differentiators

`Sing-box IaC Builder` should differentiate on:

- policy-first compilation
- macOS headless operation
- explicit staged rollout
- route ordering invariants
- user-facing rule DSL
- future natural-language rule authoring with DSL confirmation

