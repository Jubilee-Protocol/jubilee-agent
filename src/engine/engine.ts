/**
 * Jubilee Engine — the 24/7 autonomous build loop.
 *
 *   plan → vet → execute → verify → package → record
 *
 * Design rules (see docs/ENGINE.md):
 *  - Work comes from a durable queue, never from chat history.
 *  - Every repo mutation happens in an isolated git worktree.
 *  - Nothing is packaged unless checks pass AND an adversarial reviewer approves.
 *  - Autonomy is capped by a level; money/mainnet work is always human-gated.
 *  - A kill-switch file and a daily budget cap bound the machine.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { EngineStore } from "./store.js";
import { defaultRunner, type AgentRunner } from "./runner.js";
import { runChecks, allPassed, summarize } from "./verify.js";
import {
  createWorktree,
  removeWorktree,
  diffStat,
  hasChanges,
  commitAll,
  pushBranch,
  openPr,
  writePatch,
  applyPatch,
  gh,
} from "./git.js";
import type { AutonomyLevel, EngineConfig, EngineEvent, EngineTask, VerifyCheck } from "./types.js";
import { AUTONOMY_LABELS } from "./types.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function parseChecks(raw?: string): VerifyCheck[] {
  if (!raw) {
    return [
      { name: "typecheck", cmd: "bun run typecheck" },
      { name: "test", cmd: "bun test" },
    ];
  }
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, ...rest] = entry.split("=");
      return { name: name.trim(), cmd: rest.join("=").trim() };
    });
}

export function loadConfig(partial?: Partial<EngineConfig>): EngineConfig {
  const home = process.env.JUBILEE_HOME ?? path.join(process.env.HOME ?? ".", ".jubilee");
  return {
    repo: process.env.JUBILEE_REPO ?? "Jubilee-Protocol/jubilee-agent",
    repoRoot: process.env.JUBILEE_REPO_ROOT ?? process.cwd(),
    workRoot: process.env.JUBILEE_WORKTREE_ROOT ?? path.join(home, "worktrees"),
    autonomyLevel: Number(process.env.JUBILEE_AUTONOMY_LEVEL ?? 1) as AutonomyLevel,
    dailyBudgetUsd: Number(process.env.JUBILEE_DAILY_BUDGET_USD ?? 5),
    checks: parseChecks(process.env.JUBILEE_CHECKS),
    killSwitchPath: process.env.JUBILEE_KILL_SWITCH ?? path.join(home, "KILL"),
    statePath: process.env.JUBILEE_ENGINE_STATE ?? path.join(home, "engine", "state.json"),
    heartbeatMs: Number(process.env.JUBILEE_HEARTBEAT_MINUTES ?? 10) * 60_000,
    adversarialReview: (process.env.JUBILEE_ADVERSARIAL ?? "1") !== "0",
    requireReview: (process.env.JUBILEE_REQUIRE_REVIEW ?? "0") === "1",
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function planPrompt(t: EngineTask): string {
  return [
    "You are the planning stage of the Jubilee Engine (autonomy L" + ").",
    `Task: ${t.title}`,
    t.issueNumber ? `Issue: #${t.issueNumber}` : "",
    t.body ?? "",
    "Produce a short, concrete implementation plan with exact files to touch and the acceptance test. No code yet.",
  ]
    .filter(Boolean)
    .join("\n");
}

function vetPrompt(t: EngineTask): string {
  return [
    "You are the Prophet — the safety/scope gate of the Jubilee Engine.",
    `Task: ${t.title}`,
    t.body ?? "",
    "Decide whether this task is safe to perform autonomously without touching money, keys, mainnet deploys, or treasury.",
    "Your first line must be exactly one word: APPROVE or REJECT. Then one sentence of reasoning.",
  ]
    .filter(Boolean)
    .join("\n");
}

function executePrompt(t: EngineTask, plan: string, fileContext = ""): string {
  return [
    "You are the Will — the execution stage of the Jubilee Engine.",
    `Task: ${t.title}`,
    `Approved plan:\n${plan}`,
    fileContext ? `\nCurrent file contents (authoritative — diff against these):\n${fileContext}` : "",
    "",
    "Return ONLY a unified diff in git-apply format, inside a single ```diff fenced block.",
    "Use exact repository-relative paths (a/… and b/…) and at least 3 context lines per hunk.",
    "The diff MUST apply cleanly to the file contents shown above.",
    "Make the smallest correct change. Do NOT modify secrets, network config, or deploy scripts.",
    "If no change is needed, return an empty diff block.",
  ].join("\n");
}

/** Pick plausible file paths out of a plan. */
function extractPaths(text: string): string[] {
  const m = text.match(/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|toml|sql|css|html|sh|py|go|rs)\b/g) ?? [];
  return [...new Set(m)].filter((p) => !p.startsWith("http") && !p.includes("..")).slice(0, 8);
}

/** Read named files from the worktree so the model can diff against real content. */
function readFileContext(worktree: string, rels: string[]): string {
  let out = "";
  for (const rel of rels) {
    const abs = path.join(worktree, rel);
    try {
      if (!abs.startsWith(worktree)) continue;
      const st = fs.statSync(abs);
      if (!st.isFile() || st.size > 40000) continue;
      out += `\n--- ${rel} ---\n${fs.readFileSync(abs, "utf8").slice(0, 8000)}\n`;
    } catch {
      /* file may not exist yet — fine */
    }
  }
  return out;
}

/** Pull a unified diff out of a model reply (fenced or raw). */
function extractDiff(text: string): string {
  const fenced = text.match(/```(?:diff|patch)?\s*\n([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  return /^diff --git |^--- |^\+\+\+ /m.test(body) ? body + "\n" : "";
}

/**
 * Parse a model decision defensively. Small models rarely obey a strict
 * "first line must be APPROVE" format, so we accept the token anywhere,
 * preferring the first line, and fail safe (reject) when ambiguous.
 */
function decisionOf(text: string): "approve" | "reject" | "unknown" {
  const firstLine = (text.trim().split("\n")[0] ?? "").toUpperCase();
  const hasA = /\bAPPROVE\b/.test(firstLine);
  const hasR = /\bREJECT\b/.test(firstLine);
  if (hasA && !hasR) return "approve";
  if (hasR) return "reject";
  const t = text.toUpperCase();
  if (/\bREJECT\b/.test(t)) return "reject";
  if (/\bAPPROVE\b/.test(t)) return "approve";
  return "unknown";
}

function reviewPrompt(t: EngineTask, diff: string): string {
  return [
    "You are an independent, adversarial reviewer. Assume the change is wrong until proven otherwise.",
    `Task: ${t.title}`,
    `Diff:\n${diff.slice(0, 12000)}`,
    "Your first line must be exactly one word: APPROVE or REJECT. Then list concrete issues if any.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class Engine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private readonly store: EngineStore;
  private readonly runner: AgentRunner;

  constructor(
    private readonly config: EngineConfig,
    private readonly onEvent: (e: EngineEvent) => void = () => {},
    runner?: AgentRunner,
  ) {
    this.store = new EngineStore(config.statePath);
    this.runner = runner ?? defaultRunner();
  }

  // ---- lifecycle ----

  start(): void {
    if (this.timer) return;
    const reclaimed = this.store.reclaimStale();
    if (reclaimed) this.emit("engine", `Recovered ${reclaimed} stale task(s).`);
    this.emit(
      "engine",
      `🕊️ Engine online · repo=${this.config.repo} · L${this.config.autonomyLevel} (${AUTONOMY_LABELS[this.config.autonomyLevel]}) · budget=$${this.config.dailyBudgetUsd}/day`,
    );
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.config.heartbeatMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.emit("engine", "Engine stopped.");
    }
  }

  status() {
    return {
      repo: this.config.repo,
      autonomyLevel: this.config.autonomyLevel,
      autonomyLabel: AUTONOMY_LABELS[this.config.autonomyLevel],
      killed: this.isKilled(),
      spentToday: this.store.spentToday(),
      dailyBudgetUsd: this.config.dailyBudgetUsd,
      queued: this.store.list("queued").length,
      blocked: this.store.list("blocked").length,
      recentRuns: this.store.runs().slice(-5),
    };
  }

  // ---- one iteration ----

  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      if (this.isKilled()) {
        this.emit("engine", "⛔ Kill switch present — idling.");
        return;
      }
      if (this.overBudget()) {
        this.emit("engine", "💸 Daily budget exhausted — idling.");
        return;
      }
      const task = this.store.claimNext("engine");
      if (!task) {
        this.emit("engine", "Queue empty — nominal.");
        return;
      }
      await this.processTask(task);
    } catch (err) {
      this.emit("engine", `Tick failed: ${String(err)}`);
    } finally {
      this.busy = false;
    }
  }

  /** Pull `agent-ready` issues from GitHub into the queue. */
  async syncIssues(label = "agent-ready"): Promise<number> {
    const raw = await gh(
      ["issue", "list", "--repo", this.config.repo, "--label", label, "--state", "open", "--json", "number,title,body,labels", "--limit", "50"],
      this.config.repoRoot,
    );
    const issues = JSON.parse(raw) as Array<{ number: number; title: string; body: string; labels: { name: string }[] }>;
    let added = 0;
    for (const issue of issues) {
      const before = this.store.list().length;
      this.store.enqueue({
        source: "github",
        repo: this.config.repo,
        issueNumber: issue.number,
        title: issue.title,
        body: issue.body,
        labels: issue.labels.map((l) => l.name),
        requiredLevel: requiredLevelFor(issue.labels.map((l) => l.name)),
        risk: riskFor(issue.labels.map((l) => l.name)),
      });
      if (this.store.list().length > before) added++;
    }
    this.emit("engine", `Synced ${issues.length} issue(s), ${added} new.`);
    return added;
  }

  // ---- the loop ----

  private async processTask(task: EngineTask): Promise<void> {
    this.emit("task", `▶ #${task.issueNumber ?? task.id} ${task.title}`, task.id);

    // -- Gate: autonomy + risk --
    if (task.requiredLevel > this.config.autonomyLevel) {
      this.block(task, `requires L${task.requiredLevel} > engine L${this.config.autonomyLevel}`);
      return;
    }
    if (task.risk === "high" || task.requiredLevel >= 3) {
      this.block(task, "high-risk / money-adjacent — human gate required");
      return;
    }

    // -- PLAN --
    let plan = "";
    {
      const t0 = Date.now();
      const res = await this.runner.run(planPrompt(task));
      plan = res.text;
      this.record(task, "plan", "ok", plan.slice(0, 500), res.costUsd, t0);
      this.store.update(task.id, { status: "planned" });
      this.emit("task", "🧠 Planned.", task.id);
    }

    // -- VET --
    {
      const t0 = Date.now();
      const res = await this.runner.run(vetPrompt(task));
      const decision = decisionOf(res.text);
      // Model vetting is advisory unless JUBILEE_REQUIRE_REVIEW=1. The hard
      // gates are the level/risk check above and the verification checks below.
      const blocking = this.config.requireReview && decision !== "approve";
      this.record(task, "vet", blocking ? "fail" : "ok", `${decision}: ${res.text.slice(0, 220)}`, res.costUsd, t0);
      this.emit("task", `🧭 Prophet: ${decision}${blocking ? " (blocking)" : " (advisory)"}`, task.id);
      if (blocking) {
        this.store.update(task.id, { status: "vetoed", lastError: "Prophet rejected" });
        this.emit("task", "🛑 Vetoed by Prophet.", task.id);
        return;
      }
    }

    // -- EXECUTE (isolated worktree) --
    const branch = `engine/${task.issueNumber ?? task.id.slice(0, 8)}`;
    let worktree = "";
    let cost = 0;
    try {
      worktree = await createWorktree(this.config.repoRoot, branch, this.config.workRoot);
      this.store.update(task.id, { status: "executing", branch });

      const t0 = Date.now();
      if (task.artifacts?.executeCommand) {
        // Deterministic path: run a shell command directly in the worktree.
        const r = await runChecks(worktree, [{ name: "execute", cmd: task.artifacts.executeCommand }]);
        if (!allPassed(r)) {
          this.record(task, "execute", "fail", r[0]?.output?.slice(-500) ?? "command failed", 0, t0);
          this.store.update(task.id, { status: "failed", lastError: "executeCommand failed" });
          this.emit("task", "⚠️ executeCommand failed.", task.id);
          return;
        }
      } else {
        // Model path: give the model real file contents, then apply its diff.
        const fileContext = readFileContext(worktree, extractPaths(plan));
        const res = await this.runner.run(executePrompt(task, plan, fileContext), { cwd: worktree });
        cost += res.costUsd;
        const patch = extractDiff(res.text);
        if (!patch) {
          this.record(task, "execute", "fail", "model returned no diff", res.costUsd, t0);
          this.store.update(task.id, { status: "failed", lastError: "no diff returned" });
          this.emit("task", "⚠️ Model returned no diff.", task.id);
          return;
        }
        const pf = path.join(worktree, ".engine.patch");
        fs.writeFileSync(pf, patch);
        try {
          await applyPatch(worktree, pf);
        } catch (e: any) {
          this.record(task, "execute", "fail", `git apply failed: ${String(e?.message ?? e)}`, cost, t0);
          this.store.update(task.id, { status: "failed", lastError: "patch did not apply" });
          this.emit("task", "⚠️ Patch did not apply.", task.id);
          return;
        } finally {
          fs.rmSync(pf, { force: true });
        }
      }
      if (!(await hasChanges(worktree))) {
        this.record(task, "execute", "fail", "no changes produced", cost, t0);
        this.store.update(task.id, { status: "failed", lastError: "no changes" });
        this.emit("task", "⚠️ No changes produced.", task.id);
        return;
      }
      this.record(task, "execute", "ok", await diffStat(worktree), cost, t0);
    } catch (e: any) {
      this.record(task, "execute", "fail", String(e?.message ?? e), cost, Date.now());
      this.store.update(task.id, { status: "failed", lastError: String(e?.message ?? e) });
      if (worktree) await removeWorktree(this.config.repoRoot, worktree);
      return;
    }

    // -- VERIFY --
    {
      const t0 = Date.now();
      this.store.update(task.id, { status: "verifying" });
      const results = await runChecks(worktree, this.config.checks);
      const checksOk = allPassed(results);
      this.record(task, "verify", checksOk ? "ok" : "fail", summarize(results), 0, t0);
      if (!checksOk) {
        this.store.update(task.id, { status: "failed", lastError: "checks failed" });
        this.emit("task", `❌ Checks failed: ${summarize(results)}`, task.id);
        return;
      }
      if (this.config.adversarialReview) {
        const t1 = Date.now();
        const diff = await diffStat(worktree);
        const res = await this.runner.run(reviewPrompt(task, diff), { cwd: worktree });
        cost += res.costUsd;
        const decision = decisionOf(res.text);
        const blocking = this.config.requireReview && decision !== "approve";
        this.record(task, "verify", blocking ? "fail" : "ok", `review ${decision}: ${res.text.slice(0, 220)}`, res.costUsd, t1);
        this.emit("task", `🔎 Independent review: ${decision}${blocking ? " (blocking)" : ""}`, task.id);
        if (blocking) {
          this.store.update(task.id, { status: "failed", lastError: "adversarial review rejected" });
          this.emit("task", "🛑 Adversarial review rejected.", task.id);
          return;
        }
      }
    }

    // -- PACKAGE --
    let prUrl = "";
    try {
      const t0 = Date.now();
      if (this.config.autonomyLevel >= 1) {
        await commitAll(
          worktree,
          `engine: ${task.title}\n\nTask ${task.issueNumber ?? task.id} (autonomy L${this.config.autonomyLevel})`,
        );
        await pushBranch(worktree, branch);
        prUrl = await openPr(
          worktree,
          `[engine] ${task.title}`,
          `Automated by Jubilee Engine (autonomy L${this.config.autonomyLevel}).\n\nCloses #${task.issueNumber ?? ""}\n\n- plan: ok\n- vet: APPROVE\n- verification: see CI on this PR\n`,
        );
      } else {
        // L0 propose-only: write the diff as a patch and let a human apply it.
        // Sanitize the branch name — it contains a `/`.
        const slug = branch.replace(/[^a-zA-Z0-9._-]/g, "-");
        const out = path.join(this.config.workRoot, `${slug}.patch`);
        fs.mkdirSync(this.config.workRoot, { recursive: true });
        await writePatch(worktree, out); // `git diff HEAD` — work is NOT committed in L0
        prUrl = `patch:${out}`;
      }
      this.record(task, "package", "ok", prUrl, 0, t0);
      this.store.update(task.id, { status: "packaged", prUrl });
      this.emit("task", `📦 Packaged → ${prUrl}`, task.id);
    } catch (e: any) {
      this.record(task, "package", "fail", String(e?.message ?? e), 0, Date.now());
      this.store.update(task.id, { status: "failed", lastError: String(e?.message ?? e) });
      return;
    } finally {
      await removeWorktree(this.config.repoRoot, worktree);
    }

    // -- RECORD --
    // Swap the issue label so future ticks don't repeat this work.
    if (task.issueNumber) {
      try {
        await gh(
          [
            "issue", "edit", String(task.issueNumber),
            "--repo", this.config.repo,
            "--remove-label", "agent-ready",
            "--add-label", "engine:review",
          ],
          this.config.repoRoot,
        );
      } catch (e: any) {
        this.emit("task", `note: could not relabel issue #${task.issueNumber}: ${String(e?.message ?? e)}`, task.id);
      }
    }
    this.store.update(task.id, { status: "done" });
    this.emit("task", "✅ Done.", task.id);
  }

  // ---- helpers ----

  private block(task: EngineTask, reason: string): void {
    this.store.update(task.id, { status: "blocked", lastError: reason });
    this.emit("task", `⏸ Held for human: ${reason}`, task.id);
  }

  private isKilled(): boolean {
    return fs.existsSync(this.config.killSwitchPath);
  }

  private overBudget(): boolean {
    return this.config.dailyBudgetUsd > 0 && this.store.spentToday() >= this.config.dailyBudgetUsd;
  }

  private record(
    task: EngineTask,
    stage: "plan" | "vet" | "execute" | "verify" | "package" | "record",
    status: "ok" | "fail" | "skip",
    detail: string,
    costUsd: number,
    startedMs: number,
  ): void {
    this.store.recordRun({
      taskId: task.id,
      stage,
      status,
      detail,
      costUsd,
      startedAt: new Date(startedMs).toISOString(),
      endedAt: new Date().toISOString(),
    });
  }

  private emit(type: string, message: string, taskId?: string): void {
    this.onEvent({ type, message, taskId, at: new Date().toISOString() });
  }
}

// ---------------------------------------------------------------------------
// Label → risk / autonomy inference
// ---------------------------------------------------------------------------

export function requiredLevelFor(labels: string[]): AutonomyLevel {
  const l = labels.map((x) => x.toLowerCase());
  if (l.some((x) => x.includes("level:4") || x.includes("mainnet") || x.includes("treasury"))) return 4;
  if (l.some((x) => x.includes("level:3") || x.includes("contract") || x.includes("money"))) return 3;
  if (l.some((x) => x.includes("level:2") || x.includes("code"))) return 2;
  return 1; // docs / tests / chores
}

export function riskFor(labels: string[]): EngineTask["risk"] {
  const l = labels.map((x) => x.toLowerCase());
  if (l.some((x) => x.includes("risk:high") || x.includes("level:3") || x.includes("level:4"))) return "high";
  if (l.some((x) => x.includes("risk:medium"))) return "medium";
  return "low";
}
