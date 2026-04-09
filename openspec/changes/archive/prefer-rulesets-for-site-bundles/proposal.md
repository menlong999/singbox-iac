## Why

Built-in site bundles currently expand directly to hard-coded domain suffixes. That works for narrow product prompts, but it misses two important properties:

1. official `sing-geosite` / `sing-geoip` coverage is broader and more maintainable than hand-written fallback domains
2. the project has no refreshable view of upstream official rule-set tags, so users cannot clearly inspect what is available now

This change makes site bundles dual-track:

- prefer configured official rule-set tags when they are available
- fall back to curated exact domains and domain suffixes when upstream tags are missing or the current builder config does not enable them

It also adds a refreshable official rule-set catalog sourced from SagerNet upstream repositories so power users can inspect current upstream coverage.

## What Changes

- add a refreshable official rule-set catalog module for `sing-geosite` and `sing-geoip`
- add a hidden power-user CLI command to inspect configured and official rule-set tags
- change built-in site bundles to declare preferred official rule-set tags plus maintained fallback domains
- update deterministic natural-language authoring to emit `ruleSet` matchers when the current config already enables the preferred official tags
- keep fallback domain/domainSuffix behavior for products that lack official tags or for configs that have not enabled those tags yet
- expand fallback site-bundle coverage using the provided long-lived subscription rule references where official tags are absent or too coarse

## Impact

- authoring becomes less dependent on hand-maintained domain lists for products with strong official geosite coverage
- configs remain backward compatible because fallback domains still work
- power users get a concrete, refreshable view of upstream rule-set availability
