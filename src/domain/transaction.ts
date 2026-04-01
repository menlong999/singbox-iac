export interface ApplyTransaction {
  readonly txId: string;
  readonly generatedPath: string;
  readonly livePath: string;
  readonly backupPath: string;
  readonly snapshotPath?: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly status: "pending" | "applied" | "rolled-back" | "failed";
  readonly verificationSummary: Record<string, unknown>;
  readonly error?: string;
}
