# Validation

Date: 2026-04-02

## Commands

```bash
npm run lint
npm run typecheck
npx vitest run tests/cli/proxifier.test.ts
npm run build
node dist/cli/index.js proxifier bundles
node dist/cli/index.js proxifier bundles show antigravity
node dist/cli/index.js proxifier bundles render antigravity --out /tmp/antigravity.yaml
node dist/cli/index.js proxifier scaffold --config ./builder.config.local.yaml --out-dir /tmp/proxifier-smoke --prompt 'Antigravity 进程级走美国，Cursor 也走独立入口'
```

## Results

- `lint` passed.
- `typecheck` passed.
- `tests/cli/proxifier.test.ts` passed.
- `build` passed and refreshed `dist/cli/index.js`.
- `proxifier bundles` listed the declarative built-in bundles with inbound/outbound summaries.
- `proxifier bundles show antigravity` printed matcher details and notes.
- `proxifier bundles render antigravity` wrote a YAML bundle spec with `targetOutboundGroup: Process-Proxy`.
- `proxifier scaffold` generated both `bundles/*.txt` and `bundle-specs/*.yaml`, including `antigravity.yaml`, `cursor.yaml`, and `developer-ai-cli.yaml`.

## Outcome

`declarative-proxifier-bundles` is complete. Proxifier process presets are now first-class declarative bundle specs with inspectable CLI output and renderable YAML artifacts.
