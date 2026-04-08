# Change Proposal: add-trojan-parser

## Summary

Implement parsing for Base64 line-based Trojan subscriptions and produce normalized node models for the compiler.

## Why

The parser is the first executable capability that turns upstream provider data into structured input. It establishes the intermediate model that later compiler phases depend on.

## Scope

- decode Base64 subscription payloads
- split line-based share links
- parse standard `trojan://` URIs
- collect parse errors without aborting the full batch
- emit normalized node models

