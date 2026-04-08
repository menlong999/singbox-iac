# Validation

## Automated

Passed:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test -- tests/layered-authoring/layered-authoring.test.ts tests/cli/use.test.ts tests/cli/author.test.ts tests/cli/setup.test.ts tests/cli/status.test.ts tests/compiler/compiler.test.ts tests/verification-plan/verification-plan.test.ts tests/natural-language/natural-language.test.ts tests/cli/index.test.ts`

Repository-wide check:

- `npm test`
  - existing failures remain in `tests/cli/build.test.ts` and `tests/cli/update.test.ts`

## Local Dry Runs

Passed:

- `./node_modules/.bin/tsx src/cli/index.ts use 'Gemini 走新加坡' --config builder.config.local.yaml --diff --subscription-file tests/fixtures/subscriptions/trojan-sample.b64`
- `./node_modules/.bin/tsx src/cli/index.ts use 'OpenRouter 走香港' --config builder.config.local.yaml --replace --emit-intent-ir`

Observed:

- patch dry-run reported `Authoring mode: patch` and kept existing authored rules while adding a new `gemini.google.com -> SG` rule
- replace dry-run emitted a merged intent containing only the new `openrouter.ai -> HK` policy
