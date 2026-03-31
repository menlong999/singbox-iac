# Proposal: Expand Antigravity Verification Cases

## Why

Antigravity routing was already verified at a high level, but the current scenario set only covers a small subset of the product's actual runtime surfaces. Recent log inspection showed that Antigravity touches product docs, Google auth, OAuth metadata, and Google API endpoints during normal startup and conversation flows.

We need a richer Antigravity user journey suite so the automated verification loop can catch regressions earlier and better reflect real usage.

## What Changes

- Add more Antigravity-focused verification scenarios to the local and example builder configs.
- Expand the default fallback verification scenarios used by the CLI.
- Document observed and stable Antigravity-related endpoints and classify them by journey type.

## Impact

- Verification more closely matches the user's real Antigravity usage.
- Route regressions affecting auth/bootstrap/API surfaces will be caught before apply.
- No route behavior changes are introduced by this change; this is verification and documentation expansion only.
