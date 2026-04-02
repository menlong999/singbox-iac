# Design

## Fixture Shape

Each regression fixture should capture:

- intent input
- optional DSL input
- expected compiled config snapshot
- expected verification plan snapshot
- key routing or DNS assertions

The fixture library should prefer stable structured snapshots over brittle textual logs.

## Initial Fixture Set

Priority fixtures should reflect real usage and real pain points:

- `proxifier-vs-system-proxy`
- `google-stitch-us-only`
- `cn-direct-vs-ai-sites`
- `antigravity-process-route`
- `fake-ip-vs-real-ip`
- `github-openai-split-egress`

## Test Strategy

Fixtures should support fast local regression tests first. Live smoke remains valuable, but the fixture library should catch policy regressions before networked verification is required.
