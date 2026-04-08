# Proposal: fix-mvp-dns-resolution

## Why

The initial MVP generated a syntactically valid config, but its minimal DNS section relied on a `local` server that returned `SERVFAIL` in the target macOS environment when used by `sing-box` for outbound dialing. As a result, browser requests could enter the local proxy successfully and still fail before reaching any proxy node.

## What Changes

- replace the placeholder DNS section with explicit remote UDP resolvers
- set `route.default_domain_resolver` for current `sing-box` compatibility
- add test coverage for emitted DNS and route resolver fields

## Impact

- generated configs become usable for real browser and curl traffic
- no changes to parser behavior or route priority ordering
