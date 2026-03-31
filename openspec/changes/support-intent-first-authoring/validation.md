# Validation

Date: 2026-03-31

## Static Validation

- `npm run typecheck`
  - PASS
- `npm run lint`
  - PASS
- `npm test -- --run tests/natural-language/natural-language.test.ts tests/cli/author.test.ts tests/authoring/authoring.test.ts`
  - PASS

## Real Intent-First Smoke

Ran:

```bash
./node_modules/.bin/tsx src/cli/index.ts author \
  --config ./.cache/nl-intent-smoke/builder.config.local.yaml \
  --provider deterministic \
  --rules-out /Users/lvyuanfang/Code/SingBoxConfig/.cache/nl-intent-smoke/custom.rules.yaml \
  --prompt 'GitHub 这类开发类都走香港出口，Antigravity 进程级都走独立的入口并路由到美国节点，Gemini 都出口到新加坡，每30分钟自动更新'
```

Result:

- PASS
- generated rules for:
  - GitHub -> `HK`
  - Gemini -> `SG`
- updated selector defaults for:
  - `Dev-Common-Out -> HK`
  - `Process-Proxy -> US`
- preserved Proxifier note for Antigravity flow

Then ran:

```bash
./node_modules/.bin/tsx src/cli/index.ts verify --config ./.cache/nl-intent-smoke/builder.config.local.yaml
```

Result:

- PASS
- all `15/15` runtime scenarios passed on the real subscription
- important routed outcomes:
  - Antigravity proxifier traffic -> `🇺🇸 美国 01`
  - Stitch -> `🇺🇸 美国 01`
  - Gemini -> `🇸🇬 新加坡 01`
  - GitHub -> `🇭🇰 香港 01`
