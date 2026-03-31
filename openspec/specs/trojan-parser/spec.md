# Trojan Parser

## Goal

Parse `trojan://` share links into normalized node models suitable for compiler input.

## Supported Input

- Standard Trojan URI lines such as:
  - `trojan://password@host:443?sni=example.com#HK-01`

## Requirements

- The parser must accept line-based inputs.
- The parser must extract at least:
  - `host`
  - `port`
  - `password`
  - `name`
  - optional `sni`
- The parser must return structured parse errors for invalid lines.
- Invalid lines must be skipped without aborting the whole parse batch.
- Informational pseudo-nodes such as traffic or expiry notices must be skipped without aborting the whole parse batch.
- The parser output must support later translation into `sing-box` Trojan outbounds.
