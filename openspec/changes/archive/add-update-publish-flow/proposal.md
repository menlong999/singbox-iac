# Change: Add Update Publish Flow

## Why

The project can already build, verify, and apply configs as separate steps, but day-to-day operation still requires chaining multiple commands manually. That leaves room for operator drift and weakens the "closed-loop" promise of the CLI.

## What Changes

- Implement `update` as a single command that runs build, optional verification, publish, and optional reload.
- Reuse the same verification harness used by `verify`.
- Keep verification enabled by default so routine updates inherit the same route assertions as manual validation.

## Expected Outcome

The operator can run one command to refresh the subscription, prove the critical journeys still work, and publish the resulting config safely.
