# Change Proposal: add-singbox-compiler

## Summary

Implement config compilation from normalized nodes into a complete `sing-box` config with dynamic groups and stable route ordering.

## Scope

- load the base template
- compile dynamic outbounds
- generate selector and `urltest` groups
- assemble route rules with protected priority
- emit a complete config artifact

