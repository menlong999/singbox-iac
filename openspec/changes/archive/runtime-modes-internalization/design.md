# Design

## Internal-Only First

Runtime modes should begin as an internal planning abstraction, not a new required CLI parameter.

That means:

- existing user-facing commands remain simple
- onboarding continues to infer sensible defaults
- code paths can stop relying on implicit combinations of config state

## Initial Modes

The first internal modes should be:

- `browser-proxy`
- `process-proxy`
- `headless-daemon`

Additional modes can be introduced later without changing the first-run experience.

## Default Mapping

Each mode should be able to influence:

- listener assumptions
- DNS defaults
- verification scenario defaults
- schedule behavior

The mode layer should remain above compiler internals and below user-facing authoring intent.
