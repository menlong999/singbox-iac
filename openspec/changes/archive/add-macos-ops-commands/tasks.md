## Tasks

- [x] Implement `init` starter asset generation.
- [x] Ensure generated builder configs reference the generated user-rules file path.
- [x] Implement `doctor` environment checks for config, binaries, rule sets, and scheduling.
- [x] Implement `schedule install` and `schedule remove`.
- [x] Generate `launchd` plist files that can run correctly from source-tree development.
- [x] Add CLI tests for `init`, `doctor`, and `schedule`.
- [x] Run `typecheck`, `lint`, and `test`.
- [x] Run a real temporary-directory command loop:
  - `init`
  - `doctor`
  - `schedule install --no-load`
  - `plutil -lint`
  - `schedule remove --no-unload`
- [x] Record validation results.
