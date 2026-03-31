# Subscription Format Primer

## Reality of Provider Subscriptions

Provider subscriptions are not a `sing-box` native format. In practice they are ecosystem-specific feeds that commonly look like:

1. an HTTP endpoint
2. returning a Base64-encoded payload
3. which decodes into plain text
4. where each line is a share-link URI

Example:

```text
trojan://password@host:443?sni=example.com#HK-01
```

## Implication for This Project

This project should not treat provider subscriptions as a final configuration format. It should treat them as a source of nodes to parse into an intermediate representation.

Pipeline:

`fetch -> decode -> parse -> normalize -> compile`

## Phase 1 Scope

Phase 1 supports:

- Base64 line-based subscriptions
- `trojan://` share links

Later phases may support:

- `vless://`
- `vmess://`
- `hysteria2://`

