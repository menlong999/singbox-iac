import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BuilderConfig } from "../../config/schema.js";
import type { ApplyTransaction } from "../../domain/transaction.js";

interface TransactionLog {
  readonly version: 1;
  readonly entries: readonly ApplyTransaction[];
}

export interface ApplyWithTransactionInput {
  readonly config: BuilderConfig;
  readonly generatedPath: string;
  readonly livePath: string;
  readonly backupPath: string;
  readonly verificationSummary: Record<string, unknown>;
  readonly retainSnapshots?: number;
  readonly apply: () => Promise<void>;
}

export interface RollbackInput {
  readonly config: BuilderConfig;
  readonly livePath?: string;
  readonly afterRestore?: () => Promise<void>;
}

export async function applyWithTransaction(
  input: ApplyWithTransactionInput,
): Promise<ApplyTransaction> {
  const txId = createTxId();
  const historyPath = resolveTransactionHistoryPath(input.config);
  const snapshotsDir = resolveSnapshotsDir(input.config);
  await mkdir(path.dirname(historyPath), { recursive: true });
  await mkdir(snapshotsDir, { recursive: true });

  const liveExists = await pathExists(input.livePath);
  const snapshotPath = liveExists ? path.join(snapshotsDir, `${txId}.json`) : undefined;
  if (snapshotPath) {
    await copyFile(input.livePath, snapshotPath);
  }
  if (input.backupPath && liveExists) {
    await mkdir(path.dirname(input.backupPath), { recursive: true });
    await copyFile(input.livePath, input.backupPath);
  }

  const pending: ApplyTransaction = {
    txId,
    generatedPath: input.generatedPath,
    livePath: input.livePath,
    backupPath: input.backupPath,
    ...(snapshotPath ? { snapshotPath } : {}),
    startedAt: new Date().toISOString(),
    status: "pending",
    verificationSummary: input.verificationSummary,
  };
  await appendTransaction(historyPath, pending);

  try {
    await input.apply();
    const applied: ApplyTransaction = {
      ...pending,
      completedAt: new Date().toISOString(),
      status: "applied",
    };
    await replaceLatestTransaction(historyPath, applied);
    await trimSnapshots(historyPath, snapshotsDir, input.retainSnapshots ?? 5);
    return applied;
  } catch (error) {
    if (snapshotPath && (await pathExists(snapshotPath))) {
      await copyFile(snapshotPath, input.livePath);
      const rolledBack: ApplyTransaction = {
        ...pending,
        completedAt: new Date().toISOString(),
        status: "rolled-back",
        error: error instanceof Error ? error.message : String(error),
      };
      await replaceLatestTransaction(historyPath, rolledBack);
    } else {
      const failed: ApplyTransaction = {
        ...pending,
        completedAt: new Date().toISOString(),
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
      await replaceLatestTransaction(historyPath, failed);
    }
    throw error;
  }
}

export async function listTransactionHistory(
  config: BuilderConfig,
): Promise<readonly ApplyTransaction[]> {
  return (await loadTransactionLog(resolveTransactionHistoryPath(config))).entries;
}

export async function rollbackToPrevious(input: RollbackInput): Promise<ApplyTransaction> {
  const config = input.config;
  const livePath = input.livePath ?? config.output.livePath;
  const historyPath = resolveTransactionHistoryPath(config);
  const log = await loadTransactionLog(historyPath);
  const previous = log.entries.find((entry) => entry.status === "applied" && entry.snapshotPath);

  if (!previous?.snapshotPath) {
    throw new Error("No previous snapshot is available for rollback.");
  }
  if (!(await pathExists(previous.snapshotPath))) {
    throw new Error(`The previous snapshot is missing: ${previous.snapshotPath}`);
  }

  await mkdir(path.dirname(livePath), { recursive: true });
  await copyFile(previous.snapshotPath, livePath);
  if (input.afterRestore) {
    await input.afterRestore();
  }

  const tx: ApplyTransaction = {
    txId: createTxId(),
    generatedPath: previous.snapshotPath,
    livePath,
    backupPath: config.output.backupPath,
    snapshotPath: previous.snapshotPath,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: "rolled-back",
    verificationSummary: {
      rollbackTo: previous.txId,
    },
  };
  await appendTransaction(historyPath, tx);
  return tx;
}

export function resolveTransactionHistoryPath(config: BuilderConfig): string {
  return path.join(path.dirname(config.output.stagingPath), "transactions.json");
}

function resolveSnapshotsDir(config: BuilderConfig): string {
  return path.join(path.dirname(config.output.stagingPath), "snapshots");
}

async function loadTransactionLog(historyPath: string): Promise<TransactionLog> {
  if (!(await pathExists(historyPath))) {
    return { version: 1, entries: [] };
  }

  return JSON.parse(await readFile(historyPath, "utf8")) as TransactionLog;
}

async function appendTransaction(historyPath: string, entry: ApplyTransaction): Promise<void> {
  const log = await loadTransactionLog(historyPath);
  await writeFile(
    historyPath,
    `${JSON.stringify({ version: 1, entries: [entry, ...log.entries] }, null, 2)}\n`,
    "utf8",
  );
}

async function replaceLatestTransaction(
  historyPath: string,
  entry: ApplyTransaction,
): Promise<void> {
  const log = await loadTransactionLog(historyPath);
  const [, ...rest] = log.entries;
  await writeFile(
    historyPath,
    `${JSON.stringify({ version: 1, entries: [entry, ...rest] }, null, 2)}\n`,
    "utf8",
  );
}

async function trimSnapshots(
  historyPath: string,
  snapshotsDir: string,
  retainSnapshots: number,
): Promise<void> {
  const log = await loadTransactionLog(historyPath);
  const keep = new Set(
    log.entries
      .filter((entry) => entry.snapshotPath)
      .slice(0, retainSnapshots)
      .map((entry) => entry.snapshotPath as string),
  );

  if (!(await pathExists(snapshotsDir))) {
    return;
  }

  const files = await readdir(snapshotsDir);
  await Promise.all(
    files.map(async (fileName) => {
      const filePath = path.join(snapshotsDir, fileName);
      if (!keep.has(filePath)) {
        await rm(filePath, { force: true });
      }
    }),
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function createTxId(): string {
  return `tx-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
