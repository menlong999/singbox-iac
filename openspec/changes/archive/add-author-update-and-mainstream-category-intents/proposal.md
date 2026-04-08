# Proposal

## Change ID

`add-author-update-and-mainstream-category-intents`

## Why

The core user flow should feel native to developers:

- describe intent in one sentence
- let the tool understand mainstream subscription categories
- validate the result
- publish it safely

Two gaps remained:

1. natural-language support did not fully reflect common subscription vocabulary like `Amazon Prime`, `Apple TV`, `Apple 服务`, or broader `Google 服务`
2. `author` still stopped short of a one-command `write -> verify -> publish` flow

## What Changes

- broaden category and site alias coverage for common developer and video-service phrases
- allow `author` to trigger `update` directly
- keep runtime verification aligned with intent-derived overrides without breaking protected proxifier scenarios

## Out of Scope

- replacing the standalone `update` command
- supporting every possible entertainment or vendor bundle name
