# Validation

Date: 2026-03-31

## Static Validation

- `npm run typecheck`
  - PASS
- `npm run lint`
  - PASS
- `npm test`
  - PASS
  - `16` test files
  - `27` tests
- `npm run build`
  - PASS

## Focused Regression Coverage

- Added authoring-provider regression coverage for:
  - fenced JSON extraction from noisy stdout
  - reading a generated plan from `{{output_file}}`
- Verified `doctor` reporting still passes through the CLI test suite.

## Local Environment Validation

- Ran:
  - `./node_modules/.bin/tsx src/cli/index.ts doctor --config ./builder.config.local.yaml`
- Result:
  - PASS: `claude=/opt/homebrew/bin/claude (builtin)`
  - PASS: `gemini=/usr/local/bin/gemini (exec)`
  - PASS: `codebuddy=/usr/local/bin/codebuddy (exec)`
  - PASS: `cbc=/usr/local/bin/cbc (exec)`
  - PASS: `opencode=/opt/homebrew/bin/opencode (exec)`
  - PASS: `codex=/usr/local/bin/codex (exec)`
  - PASS: `trae=/usr/local/bin/trae (tooling-only)`

## Closed-Loop Exec Provider Smoke

- Created a temporary wrapper command under `.cache/exec-author-smoke/fake-author.sh`
- Ran:
  - `./node_modules/.bin/tsx src/cli/index.ts author --config ./.cache/exec-author-smoke/builder.config.local.yaml --provider exec --exec-command <wrapper> --exec-arg '{{output_file}}' --exec-arg '{{schema_file}}' --exec-arg '{{context_json}}' --rules-out <temp-rules> --prompt 'OpenRouter 走香港，每30分钟自动更新'`
- Result:
  - PASS
  - provider requested: `exec`
  - provider used: `exec`
  - rules file written
  - staging config built successfully

## Runtime Route Verification After Exec Authoring

- Ran:
  - `./node_modules/.bin/tsx src/cli/index.ts verify --config ./.cache/exec-author-smoke/builder.config.local.yaml`
- Result:
  - PASS
  - All `15/15` runtime scenarios passed on the real subscription
  - This confirmed that the broader AI CLI compatibility work did not regress:
    - Antigravity proxifier routing
    - Stitch US routing
    - China direct routing
    - HK defaults for OpenAI / ChatGPT / Gemini / Anthropic / GitHub / Google
