# Runtime on macOS

## Runtime Goal

The target runtime is a headless macOS deployment:

- `sing-box` installed separately
- this CLI generates and validates config
- `launchd` handles periodic updates

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
```

Advanced commands remain available for debugging or fine-grained control:

```bash
singbox-iac quickstart
singbox-iac setup
singbox-iac author
singbox-iac build
singbox-iac verify
singbox-iac schedule install
```

## Launchd Notes

- In source-tree development, `schedule install` emits a LaunchAgent that runs `node_modules/.bin/tsx src/cli/index.ts update --config <path>`.
- In built distributions, the same logic emits a LaunchAgent that runs the compiled CLI entrypoint with `node`.
- Use `--no-load` during testing to validate the generated plist without calling `launchctl bootstrap`.

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
