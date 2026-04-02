# Design

## Status Model

Introduce an internal `StatusReport` that aggregates:

```ts
type StatusReport = {
  generatedAt: string;
  builderConfigPath?: string;
  runtime: {
    singBoxBinary?: string;
    processRunning: boolean;
    processIds: number[];
    mode?: string;
    listeners: Array<{ tag: string; listen: string; port: number; active: boolean }>;
  };
  config: {
    stagingPath?: string;
    livePath?: string;
    backupPath?: string;
    liveExists: boolean;
  };
  scheduler: {
    enabled: boolean;
    label?: string;
    installed: boolean;
    loaded?: boolean;
    plistPath?: string;
  };
  history: {
    lastTransactionId?: string;
    lastTransactionStatus?: "applied" | "rolled_back" | "failed";
    lastTransactionAt?: string;
  };
  diagnostics: Array<{
    level: "info" | "warn" | "error";
    message: string;
  }>;
}
```

## Data Sources

- builder config and persisted runtime dependency metadata
- local process inspection (`pgrep`, `lsof`)
- launchd plist and `launchctl print` where available
- transaction history created by apply/rollback
- generated config paths on disk

## CLI Behavior

Add:

- `singbox-iac status`
- `singbox-iac status --json`

Human output should favor a concise operational summary plus a short diagnostics section.

## Relationship to Existing Commands

- `doctor` remains a dependency and environment readiness command
- `verify` remains a route correctness command
- `status` becomes the first-line operational health command

## Extensibility

The status model should be able to surface desktop-runtime details later, such as:

- system proxy enabled/disabled
- tun mode active/inactive
- runtime LaunchAgent state
