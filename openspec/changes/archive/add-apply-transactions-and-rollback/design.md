# Design

## Transaction model

```ts
type ApplyTransaction = {
  txId: string;
  generatedPath: string;
  livePath: string;
  backupPath: string;
  startedAt: string;
  completedAt?: string;
  status: "pending" | "applied" | "rolled-back" | "failed";
  verificationSummary: Record<string, unknown>;
};
```

## History storage

- store transaction records in the user config area
- keep a rolling window of snapshots, newest first
- keep enough metadata for `history` and `rollback --to previous`

## Publish flow

1. validate staging config
2. create transaction record
3. snapshot current live config if present
4. publish new live config
5. optional reload
6. record verification summary
7. mark transaction applied

If a publish-time smoke verification fails after copying live config, rollback to the previous
snapshot and record the transaction as failed.

