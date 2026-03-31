# Design

## Init

`init` copies starter assets from `examples/`:

- `builder.config.local.yaml`
- `custom.rules.yaml`

The generated builder config must point `rules.userRulesFile` at the actual `rulesOut` location chosen by the user.

## Doctor

`doctor` reports `PASS`, `WARN`, or `FAIL` for:

- operating system
- builder config presence
- `sing-box`
- Chrome
- LaunchAgents directory writability
- user rules file
- configured rule-set files
- schedule config status

Blocking issues use `FAIL`; softer gaps use `WARN`.

## Schedule

`schedule install` writes a LaunchAgent plist and optionally loads it through `launchctl`.

Execution model:

- source-tree development: use `node_modules/.bin/tsx src/cli/index.ts update --config <path>`
- built distribution: use `node dist/cli/index.js update --config <path>`

This avoids generating plist files that point Node directly at TypeScript source without a loader.

## Safety

- `schedule install --no-load` enables side-effect-free validation.
- `schedule remove --no-unload` enables side-effect-free cleanup in tests.
- launch agent files are not overwritten unless `--force` is used.
