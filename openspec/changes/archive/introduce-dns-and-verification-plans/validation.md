# Validation

Date: 2026-04-02

Implemented and validated.

Commands:

```bash
npm run typecheck
npx vitest run tests/dns-plan/dns-plan.test.ts tests/verification-plan/verification-plan.test.ts tests/verification/verification.test.ts tests/cli/update.test.ts
node dist/cli/index.js verify route --config <temp builder config>
node dist/cli/index.js verify dns --config <temp builder config>
node dist/cli/index.js verify egress --config <temp builder config>
node dist/cli/index.js verify app --config <temp builder config>
node dist/cli/index.js verify protocol --config <temp builder config>
```

Results:
- `DNSPlan` is the only source for compiled DNS config and resolver defaults.
- `VerificationPlan` now drives `verify route|dns|egress|app|protocol`.
- Real-subscription smoke passed for route, DNS, egress, app, and protocol checks.

Observed egress smoke:
- PASS `Stitch-Out -> US`
- PASS `direct -> CN`
- PASS `AI-Out -> HK`
- PASS `Dev-Common-Out -> HK`

Outcome:
- PASS `npm run typecheck`
- PASS targeted `vitest` suite for DNS and verification plan generation
- PASS real CLI smoke for `verify route`, `verify dns`, `verify egress`, `verify app`, and `verify protocol`
