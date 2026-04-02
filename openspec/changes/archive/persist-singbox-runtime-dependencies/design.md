# Design

## Builder Config Extension

Extend the runtime section with persisted dependency metadata:

```ts
runtime: {
  checkCommand: string;
  reload: { ... };
  dependencies: {
    singBoxBinary?: string;
    chromeBinary?: string;
    resolvedAt?: string;
    source?: "explicit" | "env" | "repo-tool" | "path";
  };
}
```

These fields describe the last known-good runtime executables. They are advisory metadata stored in
the user config, not hidden global state.

## Resolution Order

Runtime commands resolve binaries in this order:

1. explicit CLI flag
2. persisted builder-config dependency path
3. environment variable
4. repository `.tools` fallback
5. `PATH`

Once setup or doctor resolves a working path, the CLI should persist it back into builder config so
later update and schedule flows remain deterministic.

## Command Integration

- `go` / `setup` should persist discovered runtime dependency paths after successful doctor checks
- `doctor` should surface both the effective path and the persisted path source
- `update`, `apply`, `run`, `verify`, and `schedule install` should use persisted paths by default
- missing `sing-box` should produce install guidance for macOS users instead of only a generic
  error

## Schedule Integration

The update LaunchAgent should inherit persisted `SING_BOX_BIN` and `CHROME_BIN` values so scheduled
updates do not depend on shell startup files or a different `PATH`.

## Safety

- persisted paths must only be written after a successful existence/executable check
- explicit CLI flags still override persisted values for debugging
- if a persisted path becomes invalid, doctor and runtime commands should fall back to discovery but
  clearly report the mismatch
