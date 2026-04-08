# Validation: fix-mvp-dns-resolution

Date: 2026-03-30

## Root Cause Isolation

Observed with the original MVP config:

- requests entered the local `mixed` inbound successfully
- `CONNECT` to `example.com:443` returned `200 Connection established`
- traffic then failed before reaching the target site

Foreground `sing-box` logs showed the actual failure:

- `dns: lookup domain example.com`
- `dns: exchanged example.com SERVFAIL 0`
- `lookup failed for example.com`

This reproduced even with a `direct`-only test config, which isolated the problem to generated DNS behavior instead of Trojan parsing or policy groups.

## Working DNS Shape Validation

Validated a temporary config using:

- `dns.servers`
  - `udp 1.1.1.1:53` as `dns-remote-primary`
  - `udp 223.5.5.5:53` as `dns-remote-cn`
- `dns.final = dns-remote-primary`
- `dns.strategy = prefer_ipv4`
- `route.default_domain_resolver = dns-remote-primary`

Commands:

- `sing-box check -c .cache/generated/config.direct-test-udp-dns.json`
- `sing-box run -c .cache/generated/config.direct-test-udp-dns.json`
- `curl -x http://127.0.0.1:39197 -k -I https://example.com/`

Observed result:

- direct proxying succeeded
- foreground logs showed `dns: exchanged example.com NOERROR`

## Real Trojan Path Validation

Validated a single-node Trojan config with the same DNS shape:

- `sing-box check -c .cache/generated/config.hk01-test-udp-dns.json`
- `sing-box run -c .cache/generated/config.hk01-test-udp-dns.json`
- `curl -x http://127.0.0.1:39198 -k -I https://example.com/`

Observed result:

- Trojan proxying succeeded
- foreground logs showed `outbound/trojan[🇭🇰 香港 01]: outbound connection to example.com:443`

## Full Staging Validation

Rebuilt the real staged config from the user subscription:

- `tsx src/cli/index.ts build`
- `tsx src/cli/index.ts check`
- `sing-box run -c .cache/generated/config.staging.json`
- `curl -x http://127.0.0.1:39097 -k -I https://example.com/`

Observed result:

- generated config now includes:
  - DNS UDP servers `1.1.1.1` and `223.5.5.5`
  - `route.default_domain_resolver = dns-remote-primary`
- HTTP proxy traffic through `127.0.0.1:39097` succeeded
- foreground logs showed:
  - `inbound/mixed[in-mixed]: inbound connection to example.com:443`
  - `outbound/trojan[🇭🇰 香港 01]: outbound connection to example.com:443`

## Repository Validation

Executed successfully:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
