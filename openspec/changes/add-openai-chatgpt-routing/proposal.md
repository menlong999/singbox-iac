# Change Proposal: add-openai-chatgpt-routing

## Summary

Add explicit routing for OpenAI and ChatGPT first-party domains to the MVP compiler.

## Why

Current upstream `sing-geosite` rule sets do not provide a ready-to-use `geosite-openai.srs`, but OpenAI and ChatGPT traffic still needs predictable routing for daily use.

## Scope

- add explicit domain-based routing for `openai.com` and `chatgpt.com`
- keep these rules ahead of broader AI and developer/common-service rule sets
- validate the generated config against real subscription output

