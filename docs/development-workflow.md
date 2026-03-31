# Development Workflow

## Goal

Use OpenSpec for specification control and Superpowers for execution discipline.

## Working Model

- OpenSpec answers: what behavior should exist.
- Superpowers answers: how this change will be executed safely.

## Standard Flow for Each Phase

1. Clarify scope and non-goals.
2. Create or update `openspec/changes/<change-id>/proposal.md`.
3. Write `design.md` only for the important decisions.
4. Write `tasks.md` with small, executable tasks.
5. Update the relevant capability specs under `openspec/specs/`.
6. Write fixtures or tests before implementation where behavior is concrete.
7. Implement in small batches.
8. Run validation.
9. Fold approved behavior back into the long-lived specs.

## MVP Path

For self-hosting and early dogfooding, prefer a vertical slice when the full roadmap would delay first use too much.

Recommended first slice:

1. parse Trojan subscriptions
2. compile a minimal usable `sing-box` config
3. expose a `build` command
4. test locally with manual `sing-box check`

This keeps OpenSpec lightweight:

- use one MVP-oriented change proposal
- keep specs focused on acceptance criteria and invariants
- avoid writing extra design documents unless a decision is genuinely hard to reverse

## Phase Guidance

### Phase 0

Use OpenSpec to define project constraints, architecture, and capability boundaries. Use Superpowers to enforce small setup tasks and avoid jumping into parser or compiler code too early.

### Phase 1

Use OpenSpec to lock parser input, output, and failure semantics. Use Superpowers to drive fixture-first implementation and edge-case coverage.

If the immediate goal is self-use, combine the parser with a minimal compiler and `build` command under a vertical MVP change before returning to the broader phase roadmap.

### Phase 2

Use OpenSpec to define compiler invariants and route priority. Use Superpowers to break the compiler into template assembly, grouping, and route generation tasks.

### Phase 3

Use OpenSpec to define CLI contracts and fetch behavior. Use Superpowers to implement command-by-command instead of building the whole pipeline as one opaque step.

### Phase 4

Use OpenSpec to define runtime state transitions and safety rules. Use Superpowers to implement validation, publish, reload, and rollback in explicit steps.

### Future Rule Authoring

Use OpenSpec to define the DSL grammar and compiler guarantees. Use Superpowers to keep natural-language support behind a preview-and-confirm flow.

## Review Focus

Before closing a change, verify:

- specs still match implementation
- error handling is defensive
- route ordering invariants are protected
- user-configurable layers cannot bypass system invariants silently

## Current Recommendation

The next implementation step for this repository is `parse-and-build-first-config`. It is the shortest path from specification baseline to a locally usable config generator.
