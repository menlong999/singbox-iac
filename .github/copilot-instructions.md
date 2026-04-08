# GitHub Copilot Instructions

Read these files before making changes:

1. `/Users/lvyuanfang/Code/SingBoxConfig/docs/agent-context.md`
2. `/Users/lvyuanfang/Code/SingBoxConfig/README.md`
3. `/Users/lvyuanfang/Code/SingBoxConfig/openspec/project.md`

Use progressive disclosure:

- only open the task-relevant docs and source files listed in `docs/agent-context.md`
- follow the matching OpenSpec change before implementing behavior changes

Important project constraints:

- the architecture spine is `Intent IR -> DNSPlan / VerificationPlan -> compile -> apply transaction -> runtime`
- the current phase focuses on stabilizing `system-proxy + process-proxy + real-ip`
- `tun + fake-ip` is planned, but not the current default path
- process-aware routing and natural-language authoring are product-level capabilities, not documentation-only features
