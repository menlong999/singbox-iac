# Validation

Date: 2026-04-02

Implemented and validated.

Commands:

```bash
npm run typecheck
npx vitest run tests/intent/intent.test.ts tests/compiler/compiler.test.ts tests/natural-language/natural-language.test.ts tests/cli/author.test.ts
```

Results:
- `IntentIR` is now the normalized internal strategy object for DSL and natural-language authoring.
- `buildConfigArtifact` constructs an effective `IntentIR` before calling the compiler.
- Compiler regression coverage passes for `IntentIR -> sing-box config`.

Outcome:
- PASS `npm run typecheck`
- PASS targeted `vitest` suite for intent mapping, compiler compilation, and authoring integration
