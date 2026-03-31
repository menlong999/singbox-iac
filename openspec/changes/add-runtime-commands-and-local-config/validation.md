# Validation: add-runtime-commands-and-local-config

Date: 2026-03-30

## Repository Validation

Executed successfully:

- `npm run format`
- `npm run typecheck`
- `npm run lint`
- `npm test`

## Runtime Command Validation

Used local config:

- `builder.config.local.yaml`

Validated successfully:

- `tsx src/cli/index.ts build`
- `tsx src/cli/index.ts check`

## Staged Apply Validation

To avoid touching a live `sing-box` path during implementation:

- ran `tsx src/cli/index.ts apply --live-path .cache/applied/config.json --backup-path .cache/applied/config.backup.json`
- confirmed the staged config was validated first and then copied to the requested live path

Observed result:

- `.cache/applied/config.json` created successfully
- backup file is only created when a previous live config exists

## Foreground Run Validation

To avoid collisions with the active Clash Verge setup:

- copied the generated config
- changed inbound ports to `29897` and `29891`
- ran `tsx src/cli/index.ts run --input .cache/generated/config.run.json`
- terminated the process after confirming healthy startup

Observed startup lines included:

- `inbound/mixed[in-mixed]: tcp server started at 127.0.0.1:29897`
- `inbound/mixed[in-proxifier]: tcp server started at 127.0.0.1:29891`
- `sing-box started`

