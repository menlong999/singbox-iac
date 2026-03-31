# Validation: add-openai-chatgpt-routing

Date: 2026-03-30

## Domain Basis

Used explicit first-party domain suffixes:

- `openai.com`
- `chatgpt.com`

These were chosen because current official OpenAI surfaces reference OpenAI properties under `openai.com` and ChatGPT under `chatgpt.com`. This is an inference from official sources and is intentionally broader than single-host matching so subdomains such as API or help endpoints remain covered.

## Route Order Validation

Confirmed generated route order:

1. `sniff`
2. reject `udp:443`
3. hijack DNS
4. route `in-proxifier` to `Process-Proxy`
5. route `stitch.withgoogle.com` to `Stitch-Out`
6. route `openai.com` and `chatgpt.com` to `AI-Out`
7. route AI rule sets to `AI-Out`
8. route developer/common rule sets to `Dev-Common-Out`
9. route China rule sets to `direct`

## Automated Validation

Executed successfully:

- `npm run format`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `tsx src/cli/index.ts build --subscription-url <user-url> --output .cache/generated/config.real.json`
- `sing-box check -c .cache/generated/config.real.json`
