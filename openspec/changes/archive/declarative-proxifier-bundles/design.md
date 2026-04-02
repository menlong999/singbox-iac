# Design

## Bundle Spec

Each built-in process bundle should describe:

- a stable bundle name
- process matchers
- target inbound
- target outbound group
- optional notes for user-facing output

The spec becomes the single source of truth for:

- CLI listing and inspection
- rendered helper files
- process-aware documentation
- future verification fixtures for developer tools

## CLI Shape

The `proxifier bundles` command family should expose:

- `list`
- `show <id>`
- `render <id>`

`scaffold` can remain as a compatibility layer, but it should internally resolve bundle specs rather than constructing assets procedurally.

## Authoring Integration

Natural-language prompts that imply process-aware routing should be able to map to bundle specs rather than free-form process name lists whenever a built-in bundle exists.

That keeps process routing repeatable and easier to verify.
