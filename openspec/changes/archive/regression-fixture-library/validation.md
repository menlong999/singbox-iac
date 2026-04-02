# Validation

Date: 2026-04-02

## Commands

```bash
npm run fixtures:regenerate
npx vitest run tests/regression/fixture-library.test.ts
npm run typecheck
npm run lint
npm test
npm run build
```

## Results

- `fixtures:regenerate` generated and normalized six regression fixture snapshots:
  - `proxifier-vs-system-proxy`
  - `google-stitch-us-only`
  - `cn-direct-vs-ai-sites`
  - `antigravity-process-route`
  - `fake-ip-vs-real-ip`
  - `github-openai-split-egress`
- `tests/regression/fixture-library.test.ts` passed with snapshot comparisons, optional DSL intent checks, and targeted routing/DNS assertions.
- `typecheck` passed.
- `lint` passed.
- `npm test` passed with the regression fixture suite included.
- `build` passed.

## Outcome

`regression-fixture-library` is complete. The repository now has a dedicated, reproducible regression fixture suite for real-world developer routing scenarios, with stable config and verification-plan snapshots.
