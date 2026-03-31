# Subscription Ingestion

## Goal

Fetch provider subscriptions and prepare them for parsing.

## Requirements

- The system must support HTTP fetching of provider subscription data.
- The system must support Base64-encoded line-based subscriptions.
- The system must produce decoded raw lines for downstream parsing.
- Network errors must be surfaced as structured failures.
- Empty or malformed payloads must not be treated as successful fetches.
- Provider endpoints that vary responses by User-Agent should prefer the raw subscription payload over client-specific rendered configs when possible.

## Notes

This capability does not define protocol parsing. It only defines how raw subscription material enters the system.
