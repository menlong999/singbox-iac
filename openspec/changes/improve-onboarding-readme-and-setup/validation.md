# Validation

Date: 2026-03-31

## Tooling

- `npm run lint` ✅
- `npm test` ✅
- `npm run build` ✅

## README And Docs

- Updated the public README to include:
  - bilingual project overview
  - architecture diagram
  - user journey diagram
  - security posture
  - explicit explanation of natural-language authoring, minimal DSL, and process-aware routing

## Setup Flow

- `setup` now prints an environment readiness summary via the doctor module unless `--no-doctor` is used.
- `setup` now supports:
  - `--verify`
  - `--apply`
  - `--reload`
  - `--ready`
- `--ready` provides a more guided first-run activation path by enabling:
  - doctor summary
  - verification
  - publish
  - schedule installation

## Test Coverage

- Updated `tests/cli/setup.test.ts` to assert the setup output now includes the doctor summary.
