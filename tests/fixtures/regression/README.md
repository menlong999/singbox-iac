# Regression Fixtures

Each fixture directory captures one real-world routing scenario as stable structured inputs and outputs.

## Directory Shape

- `fixture.json`: fixture metadata, active rule sets, verification scenarios, and optional group overrides
- `intent.json`: expected `IntentIR`
- `dsl.yaml`: optional user-facing DSL that should compile to the same site intent
- `compiled-config.json`: normalized compiled sing-box config snapshot
- `verification-plan.json`: normalized verification plan snapshot

## Updating Fixtures

1. Copy an existing fixture directory as a starting point.
2. Edit `fixture.json` and `intent.json`.
3. Add `dsl.yaml` only if the scenario should cover the DSL input path.
4. Regenerate snapshots:

```bash
npm run fixtures:regenerate
```

5. Run the focused regression suite:

```bash
npx vitest run tests/regression/fixture-library.test.ts
```

## Guidance

- Prefer stable structured assertions over volatile logs.
- Keep each fixture focused on one routing failure mode or policy edge case.
- Use the targeted assertions in `tests/regression/fixture-library.test.ts` to lock down the most important DNS or routing guarantees.
