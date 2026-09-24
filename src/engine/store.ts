/**
 * Jubilee Engine — durable store.
 *
 * A crash-safe, dependency-light durable queue + run ledger backed by a single
 * JSON file with atomic writes. Postgres can back this later (see README); the
 * file store is enough for a supervised single-node engine and keeps the loop
 * runnable with zero external services.
 */
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { EngineTask, RunRecord, TaskStatus } from "./types.js";

interface EngineState {
  schemaVersion: 1;
  tasks: EngineTask[];
  runs: RunRecord[];
  /** daily spend buckets keyed by YYYY-MM-DD */
  spend: Record<string, number>;
  lastSweep?: string;
}

const EMPTY: EngineState = { schemaVersion: 1, tasks: [], runs: [], spend: {} };

export class EngineStore {
  constructor(private readonly statePath: string) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
  }

  private read(): EngineState {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.statePath, "utf8")) as EngineState;
      if (!parsed || !Array.isArray(parsed.tasks)) return { ...EMPTY };
      return parsed;
    } catch {
      return { ...EMPTY };
    }
  }

  private write(state: EngineState): void {
    const tmp = `${this.statePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, this.statePath); // atomic within a filesystem
  }

  enqueue(task: Partial<EngineTask> & { title: string; repo: string }): EngineTask {
    const now = new Date().toISOString();
    const full: EngineTask = {
      id: task.id ?? randomUUID(),
      source: task.source ?? "manual",
      repo: task.repo,
      issueNumber: task.issueNumber,
      title: task.title,
      body: task.body,
      labels: task.labels ?? [],
      priority: task.priority ?? 100,
      risk: task.risk ?? "low",
      requiredLevel: task.requiredLevel ?? 1,
      status: "queued",
      attempts: 0,
      costUsd: 0,
      createdAt: now,
      updatedAt: now,
    };
    const state = this.read();
    if (full.issueNumber) {
      const dup = state.tasks.find((t) => t.repo === full.repo && t.issueNumber === full.issueNumber);
      if (dup) return dup; // idempotent per issue
    }
    state.tasks.push(full);
    this.write(state);
    return full;
  }

  /** Claim the highest-priority actionable task. Single-process safe. */
  claimNext(by: string): EngineTask | null {
    const state = this.read();
    const next = state.tasks
      .filter((t) => t.status === "queued")
      .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt))[0];
    if (!next) return null;
    next.status = "claimed";
    next.claimedBy = by;
    next.attempts += 1;
    next.updatedAt = new Date().toISOString();
    this.write(state);
    return next;
  }

  update(id: string, patch: Partial<EngineTask>): EngineTask | null {
    const state = this.read();
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, patch, { updatedAt: new Date().toISOString() });
    this.write(state);
    return t;
  }

  get(id: string): EngineTask | null {
    return this.read().tasks.find((t) => t.id === id) ?? null;
  }

  list(status?: TaskStatus): EngineTask[] {
    const all = this.read().tasks;
    return status ? all.filter((t) => t.status === status) : all;
  }

  recordRun(run: Omit<RunRecord, "id" | "startedAt" | "endedAt"> & Partial<RunRecord>): RunRecord {
    const now = new Date().toISOString();
    const full = {
      id: run.id ?? randomUUID(),
      startedAt: run.startedAt ?? now,
      endedAt: run.endedAt ?? now,
      ...run,
    } as RunRecord;
    const state = this.read();
    state.runs.push(full);
    if (full.costUsd) {
      const day = now.slice(0, 10);
      state.spend[day] = (state.spend[day] ?? 0) + full.costUsd;
    }
    this.write(state);
    return full;
  }

  runs(): RunRecord[] {
    return this.read().runs;
  }

  spentToday(): number {
    return this.read().spend[new Date().toISOString().slice(0, 10)] ?? 0;
  }

  /** Recover tasks left "claimed" by a dead process (called on boot). */
  reclaimStale(maxAgeMs = 60 * 60_000): number {
    const state = this.read();
    const cutoff = Date.now() - maxAgeMs;
    let n = 0;
    for (const t of state.tasks) {
      if (t.status === "claimed" && Date.parse(t.updatedAt) < cutoff) {
        t.status = t.attempts >= 3 ? "failed" : "queued";
        t.lastError = "reclaimed after stale claim";
        t.updatedAt = new Date().toISOString();
        n++;
      }
    }
    if (n) this.write(state);
    return n;
  }
}
