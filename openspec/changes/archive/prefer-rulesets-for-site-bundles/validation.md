## Validation

### Official upstream scan

- `sing-geosite` rule-set branch: `1736` `.srs` tags at ref `3aaad8ba2f34b52f4d6bf8ed78d3908c8b260eba`
- `sing-geoip` rule-set branch: `237` `.srs` tags at ref `6611af30ec3490a97b2a22a6b3b6623365f640e0`

### Targeted tests

- `npm test -- tests/bundle-registry/bundle-registry.test.ts tests/natural-language/natural-language.test.ts tests/rule-set-catalog/rule-set-catalog.test.ts tests/cli/rulesets.test.ts tests/cli/setup.test.ts tests/cli/init.test.ts tests/cli/proxifier.test.ts`

Passed.

### Full repository validation

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test`

Passed:

- `46` test files
- `119` tests

### Notes

- Built-in site bundles now prefer active official rule-set tags when the current config has the corresponding local `.srs` file.
- When the current config does not enable a preferred official tag, authoring falls back to curated exact domains and domain suffixes and records a note explaining the fallback.
- Curated fallback-first site bundles were expanded with subscription-derived references for `LeetCode`, `TradingView`, `TypingMind`, `Roam Research`, `Todoist`, `IFTTT`, `Humble Bundle`, `Fanatical`, `Grindr`, and `Behance`.
