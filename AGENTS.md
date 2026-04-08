# Agent Entry

Read these files in order:

1. `/Users/lvyuanfang/Code/SingBoxConfig/README.md`
2. `/Users/lvyuanfang/Code/SingBoxConfig/docs/agent-context.md`
3. `/Users/lvyuanfang/Code/SingBoxConfig/openspec/project.md`

Then read only the docs and source files relevant to the task:

- authoring / DSL: `docs/natural-language-authoring.md`, `docs/rules-dsl.md`, `src/domain/intent.ts`
- runtime / diagnostics: `docs/runtime-on-macos.md`, `docs/runtime-modes.md`, `src/modules/status/index.ts`, `src/modules/desktop-runtime/index.ts`
- compiler / DNS / verification: `docs/sing-box-config-primer.md`, `src/domain/dns-plan.ts`, `src/domain/verification-plan.ts`, `src/modules/compiler/index.ts`
- process-aware routing: `docs/proxifier-onboarding.md`, `docs/antigravity-endpoints.md`, `src/modules/proxifier/index.ts`

Working rules:

- treat `Intent IR -> DNSPlan / VerificationPlan -> compile -> apply transaction -> runtime` as the architectural spine
- keep the current phase focused on stabilizing `system-proxy + process-proxy + real-ip`
- do not jump to `tun + fake-ip` implementation until the current runtime stability changes land
- update OpenSpec before implementation when long-lived behavior changes
