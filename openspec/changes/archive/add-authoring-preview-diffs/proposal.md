# Proposal: Add Authoring Preview Diffs

## Why

Natural-language authoring and local AI CLI authoring are now powerful enough to change real rules, schedule settings, and staged configs. Before those writes happen, developers need a safe preview path.

The preview should answer:

- what rules file would change
- what builder config fields would change
- what staged sing-box config would change

without mutating local files.

## What Changes

- Add `author --preview`.
- Render generated rules in memory.
- Render builder-config changes in memory.
- Build a temporary staging config for diff purposes only.
- Print unified diffs for rules, builder config, and staging config.

## Impact

- Prompt experimentation becomes safer.
- Local AI CLI provider changes become inspectable before writing.
- The project gets a proper preview step before the existing `build -> verify -> apply` chain.
