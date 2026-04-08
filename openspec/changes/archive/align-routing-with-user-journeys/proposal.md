# Change: Align Routing With User Journeys

## Why

The MVP compiler and verification harness already prove that generated configs can run and route traffic, but the default selector behavior still reflects generic defaults rather than the user's real operating model:

- `in-proxifier` traffic should pin to a fixed US `OnlyAI` node.
- Google Stitch should always use a US path.
- China traffic should remain direct.
- AI and developer traffic should default to the HK-tagged path that this provider effectively egresses through Singapore.

These expectations must be encoded in builder config and validated automatically, not kept as ad hoc manual knowledge.

## What Changes

- Extend group configuration so selector groups can pin a default region, an exact default target, or a node tag pattern such as `OnlyAI`.
- Extend the verification harness to read user-journey scenarios from builder config instead of relying only on hard-coded defaults.
- Encode the current operator journeys for Antigravity, Stitch, China direct, AI, and developer traffic into the local builder config and the example config.
- Capture Antigravity-relevant verification URLs that reflect the installed app's real Google endpoints.

## Expected Outcome

Running `verify` should assert the real journeys end-to-end with a generated config, a temporary `sing-box` instance, and automated Chrome traffic, without requiring manual participation.
