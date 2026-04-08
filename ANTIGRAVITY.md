# Antigravity Agent Notes

Read this first when working on the repo through Antigravity:

1. `/Users/lvyuanfang/Code/SingBoxConfig/docs/agent-context.md`
2. `/Users/lvyuanfang/Code/SingBoxConfig/README.md`
3. `/Users/lvyuanfang/Code/SingBoxConfig/openspec/project.md`

Then narrow scope by task:

- runtime / recovery / diagnostics: `docs/runtime-on-macos.md`, `docs/runtime-modes.md`
- process-aware routing: `docs/proxifier-onboarding.md`, `docs/antigravity-endpoints.md`
- authoring / intent: `docs/natural-language-authoring.md`, `docs/rules-dsl.md`

Project guardrails:

- prefer small changesets and strong verification
- preserve the current runtime path before widening to `tun + fake-ip`
- do not treat natural-language authoring as free-form chat; it is an intent compiler
