# OpenSpec Working Notes

Read `/Users/lvyuanfang/Code/SingBoxConfig/docs/agent-context.md` before exploring `openspec/` so the current phase and roadmap are clear.

## Purpose

This directory stores the long-lived specification assets for `Sing-box IaC Builder`.

## Rules

- `project.md` defines project-wide constraints and conventions.
- `specs/` describes the current desired system behavior by capability.
- `changes/` describes proposed and active modifications to the system.
- Code should follow approved behavior from specs before implementation expands scope.

## Execution Discipline

- Use small changesets.
- Update specs before implementation when behavior is changing.
- Keep implementation phases aligned with `changes/*/tasks.md`.
- Prefer progressive disclosure: read only the spec, change, and docs that are relevant to the current task.
