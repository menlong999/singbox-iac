# Validation

Date: 2026-04-02

Implemented and validated.

Commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx vitest run tests/authoring/authoring.test.ts tests/natural-language/natural-language.test.ts tests/cli/use.test.ts tests/cli/author.test.ts
node dist/cli/index.js author --config ./builder.config.local.yaml --prompt 'OpenRouter 走香港' --strict --diff
node dist/cli/index.js author --config ./builder.config.local.yaml --prompt 'OpenRouter 走香港' --emit-intent-ir
node dist/cli/index.js author --config ./builder.config.local.yaml --prompt 'AI 都走好一点的节点' --strict
```

Results:
- natural-language authoring now reports ambiguity diagnostics and rejects them in strict mode
- `author` and `use` both support `--strict`
- `author` and `use` both support `--emit-intent-ir`
- `author` and `use` both support `--diff`
- diff output now includes `Intent IR diff` before rules/config/staging diffs
- `--emit-intent-ir` prints structured JSON and exits without writing files
- strict mode rejects vague prompts such as `AI 都走好一点的节点`

Outcome:
- PASS `npm run lint`
- PASS `npm run typecheck`
- PASS `npm test`
- PASS targeted `vitest` suite for strict-mode authoring, prompt ambiguity detection, and CLI output behavior
- PASS real smoke for `author --strict --diff`
- PASS real smoke for `author --emit-intent-ir`
- PASS expected failure for ambiguous strict-mode prompt
