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
singbox-iac setup --ready
singbox-iac author --prompt '<一句话需求>' --update
singbox-iac build
singbox-iac verify
singbox-iac proxifier scaffold
singbox-iac schedule install
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

Closed-loop verification does not need privileged `tun` startup:

- generated staging and live configs still keep the configured `tun` inbound
- the transient verification runtime rewrites `in-tun` into a local unprivileged listener shape
- the transient verification runtime also forces a local real-ip DNS shape and drops `fakeip` cache-file dependencies
- normal `use`, `setup`, `update`, and `verify` flows therefore do not need `tun` device permissions just to validate routing behavior

## Runtime Control

Use the dedicated runtime commands for GUI-like everyday control:

```bash
singbox-iac start
singbox-iac stop
singbox-iac restart
singbox-iac status
singbox-iac diagnose
```

- `start` writes or refreshes a dedicated runtime LaunchAgent and boots it
- `stop` unloads and removes that runtime LaunchAgent
- `restart` replaces the runtime LaunchAgent
- `status` reports `sing-box` binary resolution, live config presence, desktop runtime state, system proxy/TUN hints, scheduler state, and recent transactions
- `diagnose` adds a higher-level local-network and DNS evidence pass on top of `status`

Use the commands this way:

- `doctor`: first-run or packaging readiness, such as missing binaries, unwritable LaunchAgents, or missing rule-set files
- `status`: current runtime snapshot, including process state, listeners, system proxy/TUN state, scheduler state, and recent publish history
- `diagnose`: failure triage when `status` is not enough, because it combines runtime state with best-effort default-route, system DNS, and representative domain resolution evidence

For the default `system-proxy` desktop profile, `status` now compares the expected `in-mixed` endpoint against the current macOS proxy state and makes drift explicit.

At minimum it distinguishes:

- runtime stopped
- runtime running with proxy active
- runtime running with proxy drift because the proxy is inactive
- runtime running with proxy drift because the proxy endpoint no longer matches
- runtime running with proxy drift because `in-mixed` is no longer accepting connections

When drift is present, `status` prints:

- the expected `in-mixed` host and port
- the currently enabled macOS proxy endpoint state
- a short next-action hint such as restarting the desktop runtime

## Runtime Watchdog

For the current `system-proxy` desktop profile, `start` also installs a lightweight runtime watchdog LaunchAgent by default.

The watchdog currently:

- wakes up on a fixed 60-second interval by default
- checks whether the `sing-box` process is still alive
- checks whether `in-mixed` is still accepting connections
- checks whether macOS system proxy state still points to the configured `in-mixed` endpoint
- reasserts the proxy endpoint when drift is detected but the runtime process is otherwise healthy
- escalates to a runtime LaunchAgent restart when the runtime is already unhealthy or reassert does not recover the runtime

Current limits:

- only `system-proxy` desktop mode is covered
- the watchdog records state changes for `status`, including the last successful reassert time when one exists
- identical repeated poll results do not rewrite the watchdog state file
- proxy reassert relies on the normal macOS network service tooling, so failures remain visible in watchdog status and logs instead of being silently ignored

Sleep/wake and network-change recovery in the current phase is symptom-driven, not event-hook driven:

- there is no second always-on LaunchAgent that subscribes to native macOS wake or network notifications
- the normal watchdog tick detects the common aftermath within the next polling window
- runtime restart escalation is guarded by a fixed 5-minute cooldown so repeated failures do not cause a restart every 60 seconds

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
