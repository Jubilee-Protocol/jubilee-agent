/**
 * Jubilee Engine — shared types.
 *
 * The Engine is the durable, supervised 24/7 build loop for the protocol:
 * it picks work from a queue, plans it, vets it, executes it in isolation,
 * verifies it, packages it (branch + PR), and records the outcome.
 */

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  0: "propose-only (human merges everything)",
  1: "docs / tests / chores (auto-merge when CI green)",
  2: "non-critical code (auto-merge when CI + adversarial review green)",
  3: "money-adjacent (human gate required)",
  4: "mainnet / deploys / treasury (human gate required)",
};

export type Risk = "low" | "medium" | "high";

export type TaskStatus =
  | "queued"
  | "claimed"
  | "planned"
  | "vetoed"
  | "executing"
  | "verifying"
  | "packaged"
  | "done"
  | "failed"
  | "blocked";

export interface EngineTask {
  id: string;
  source: "github" | "manual" | "cron";
  repo: string; // owner/name
  issueNumber?: number;
  title: string;
  body?: string;
  labels: string[];
  priority: number; // lower runs first
  risk: Risk;
  /** Autonomy level this task requires; the engine refuses anything above its own level. */
  requiredLevel: AutonomyLevel;
  status: TaskStatus;
  claimedBy?: string;
  attempts: number;
  costUsd: number;
  createdAt: string;
  updatedAt: string;
  branch?: string;
  prUrl?: string;
  lastError?: string;
  artifacts?: Record<string, string>;
}

export interface RunRecord {
  id: string;
  taskId: string;
  stage: "plan" | "vet" | "execute" | "verify" | "package" | "record";
  status: "ok" | "fail" | "skip";
  detail?: string;
  costUsd: number;
  startedAt: string;
  endedAt: string;
}

export interface EngineEvent {
  type: string;
  message: string;
  taskId?: string;
  data?: unknown;
  at: string;
}

export interface VerifyCheck {
  name: string;
  cmd: string;
}

export interface EngineConfig {
  /** Target repo as owner/name. */
  repo: string;
  /** Working clone to operate on (isolated worktrees are created from here). */
  workRoot: string;
  /** Autonomy ceiling the engine may act at without a human. */
  autonomyLevel: AutonomyLevel;
  /** Hard daily LLM/CI spend cap in USD. 0 = uncapped (not recommended). */
  dailyBudgetUsd: number;
  /** Checks that must pass in the worktree before packaging. */
  checks: VerifyCheck[];
  /** Kill-switch file; if present, the engine stops claiming work. */
  killSwitchPath: string;
  /** Where durable engine state lives. */
  statePath: string;
  /** Heartbeat interval, ms. */
  heartbeatMs: number;
  /** Run an independent adversarial review before packaging. */
  adversarialReview: boolean;
  /** Local path to the working clone used as the worktree base. */
  repoRoot: string;
}
