# Runtime on macOS

## Runtime Goal

The target runtime is a headless macOS deployment:

- `sing-box` installed separately
- this CLI generates and validates config
- `launchd` handles periodic updates
- a dedicated runtime LaunchAgent can keep `sing-box` running in desktop mode

## Planned Flow

1. Generate a staging config
2. Run `sing-box check -c <staging>`
3. If valid, publish to the live path
4. Reload `sing-box`
5. Keep the last-known-good config for recovery

## Current CLI Flow

```bash
singbox-iac go '<url>' '<一句话策略>'
singbox-iac use '<新的需求描述>'
singbox-iac update
singbox-iac start
singbox-iac stop
singbox-iac status
```

Advanced commands remain available for debugging or fine-grained control:

```bash
singbox-iac quickstart
singbox-iac setup
singbox-iac author
singbox-iac build
singbox-iac verify
singbox-iac schedule install
singbox-iac restart
```

## Desktop Runtime Profiles

The builder config now persists an internal desktop runtime profile:

- `system-proxy`
  - `in-mixed` is still used
  - `set_system_proxy: true` is emitted so `sing-box` can set and clean the macOS system proxy
- `tun`
  - a `tun` inbound is emitted
  - `auto_route` is enabled
  - this is closer to the "global capture" experience of GUI clients

During onboarding, prompts that mention `TUN`, `全局代理`, or `全局模式` are inferred as `tun`; otherwise the default is `system-proxy`.

## Runtime Control

Use the dedicated runtime commands for GUI-like everyday control:

```bash
singbox-iac start
singbox-iac stop
singbox-iac restart
singbox-iac status
```

- `start` writes or refreshes a dedicated runtime LaunchAgent and boots it
- `stop` unloads and removes that runtime LaunchAgent
- `restart` replaces the runtime LaunchAgent
- `status` reports `sing-box` binary resolution, live config presence, desktop runtime state, system proxy/TUN hints, scheduler state, and recent transactions

## Launchd Notes

- In source-tree development, `schedule install` emits a LaunchAgent that runs `node_modules/.bin/tsx src/cli/index.ts update --config <path>`.
- In built distributions, the same logic emits a LaunchAgent that runs the compiled CLI entrypoint with `node`.
- Use `--no-load` during testing to validate the generated plist without calling `launchctl bootstrap`.
- Desktop runtime uses a separate LaunchAgent label from the update scheduler.

## Why `launchd`

For macOS, `launchd` is the correct scheduler primitive. It integrates better with user sessions than `cron` and matches the product's OS target.

## Runtime Safety

The tool must never overwrite the live config with an unchecked file.

## Simplified Onboarding

For npm-installed users, the preferred onboarding path is now:

```bash
singbox-iac go '<url>' '<一句话策略>'
```

That flow avoids manually chaining `init`, local ruleset downloads, route verification, and the first publish.

After onboarding, the preferred day-to-day commands are:

```bash
singbox-iac use '<新的需求描述>'
singbox-iac update
```

`update` now reloads `sing-box` automatically when the configured runtime target is already running.

If the prompt includes process-aware intent such as `Proxifier`, `进程级`, `Antigravity`, or `Cursor`, the onboarding flow should also generate `~/.config/singbox-iac/proxifier/` helper files so the user can set up process-level routing without manually reverse-engineering app process names.
