# Validation: use-conflict-averse-default-ports

Date: 2026-03-30

## Port Selection Check

Confirmed that the chosen fallback ports were not currently listening before the change:

- `39097`
- `39091`

## Repository Validation

Executed successfully:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Runtime Validation

Used the real local config in `builder.config.local.yaml` and rebuilt the staging artifact:

- `tsx src/cli/index.ts build`
- `tsx src/cli/index.ts check`

Confirmed the generated staging config now contains:

- `in-mixed -> 127.0.0.1:39097`
- `in-proxifier -> 127.0.0.1:39091`

Performed a foreground runtime smoke test:

- `tsx src/cli/index.ts run --input .cache/generated/config.staging.json`

Observed startup lines included:

- `inbound/mixed[in-mixed]: tcp server started at 127.0.0.1:39097`
- `inbound/mixed[in-proxifier]: tcp server started at 127.0.0.1:39091`
- `sing-box started`

The process was then terminated manually after confirming healthy startup.
