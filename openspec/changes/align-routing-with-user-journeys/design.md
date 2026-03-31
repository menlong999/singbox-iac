# Design Notes

## Selector Defaults

Each policy selector keeps its `includes` list, but may now also express one of two stronger intents:

- `defaultTarget`: choose an explicit selector or leaf tag when it is present.
- `defaultNodePattern`: choose the first matching leaf tag from the selector's resolved candidate nodes.

This lets the operator keep region-level fallbacks while pinning critical journeys such as `Process-Proxy` to a specific `OnlyAI` node.

## Scenario-Driven Verification

The verification harness already proves route selection by observing real `sing-box` runtime logs while driving headless Chrome through the generated local proxy ports.

This change moves the runtime scenario list into builder config so the operator can codify journeys such as:

- Antigravity via `in-proxifier`
- Stitch via `in-mixed`
- China direct via `in-mixed`
- AI and developer traffic via HK defaults

Each scenario names an expected selector or leaf. Verification resolves selectors to their effective leaf default before asserting runtime logs.
