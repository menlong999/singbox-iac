# Design: parse-and-build-first-config

## Delivery Strategy

Use a vertical MVP slice instead of completing the full roadmap phase-by-phase.

The MVP slice spans:

1. a minimal parser
2. a minimal compiler
3. a minimal `build` CLI flow

This allows the project to become usable early while preserving the long-term capability boundaries already defined in the specs.

## Minimal Usable Behavior

The first generated config should include:

- a fixed `in-mixed` listener
- a fixed `in-proxifier` listener
- parsed Trojan outbounds from the subscription
- `direct` and one global selector-like egress path
- the protected route order required by project policy

## Intentional Simplifications

For the MVP:

- grouping may be static or minimal
- route customization remains hard-coded
- runtime apply remains manual
- `build` is the only required end-user command

## Why This Is Safe

This change does not weaken the architecture. It only changes implementation order:

- capability specs still define the long-term model
- later changes can harden fetch, compiler, runtime, and rule authoring independently
- the MVP remains aligned with the same parser and compiler boundaries

