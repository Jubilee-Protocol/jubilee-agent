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
import { defaultRunner, runnerFor, type AgentRunner } from "./runner.js";
import { systemOne, extractArray } from "./decision.js";
import { parseEdits, applyEdits } from "./edits.js";
import { runChecks, allPassed } from "./verify.js";
import { runGauntlet } from "./gauntlet.js";
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
  ghIssueComment,
  ghIssueLabels,
  ghIssueComments,
  gitLsFiles,
  readIssueLedger,
  upsertIssueLedger,
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
    gauntletRounds: Number(process.env.JUBILEE_GAUNTLET_ROUNDS ?? 3),
    reviewIssue: process.env.JUBILEE_REVIEW_ISSUE ? Number(process.env.JUBILEE_REVIEW_ISSUE) : undefined,
    setupCommand: process.env.JUBILEE_SETUP || undefined,
    execRunnerKind: process.env.JUBILEE_EXEC_RUNNER || undefined,
    execModel: process.env.JUBILEE_EXEC_MODEL || undefined,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function planPrompt(t: EngineTask, humanNotes = "", contract = ""): string {
  return [
    "You are the planning stage of the Jubilee Engine (autonomy L" + ").",
    `Task: ${t.title}`,
    t.issueNumber ? `Issue: #${t.issueNumber}` : "",
    t.body ?? "",
    contract ? `\nContract to honour:\n${contract}` : "",
    humanNotes ? `\nHuman feedback (honour this):\n${humanNotes.slice(0, 3000)}` : "",
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

function executePrompt(t: EngineTask, plan: string, fileContext = "", feedback = ""): string {
  return [
    "You are the Will — the execution stage of the Jubilee Engine.",
    `Task: ${t.title}`,
    `Approved plan:\n${plan}`,
    fileContext ? `\nCurrent file contents (authoritative — edit against these EXACTLY):\n${fileContext}` : "",
    feedback ? `\nYour previous attempt failed: ${feedback}` : "",
    "",
    "Return the change as Aider-style edit blocks, one per file:",
    "path/to/file",
    "<<<<<<< SEARCH",
    "<exact existing lines, copied verbatim from the file contents above>",
    "=======",
    "<replacement lines>",
    ">>>>>>> REPLACE",
    "",
    "Copy the SEARCH lines EXACTLY. Make the smallest correct change. Do NOT modify secrets, network config, or deploy scripts.",
  ].join("\n");
}

/** Durable per-issue state lives as a single marker-tagged issue comment. */
const LEDGER_MARKER = "<!-- jubilee-engine:ledger -->";

function contractPrompt(t: EngineTask): string {
  return [
    "Write a compact CONTRACT for this task. Terse, exactly three lines:",
    "SCOPE: <the files/area this changes>",
    "SUCCESS: <the objective test that proves it is done>",
    "CONSTRAINTS: <what must NOT change>",
    "",
    `TASK: ${t.title}`,
    t.body ?? "",
  ].join("\n");
}

function scorePrompt(t: EngineTask, plan: string, candidates: string[]): string {
  return [
    "Choose the FEWEST files a coder must read to make this change.",
    `TASK: ${t.title}`,
    `PLAN: ${plan.slice(0, 1500)}`,
    "Candidate files (choose only from these):",
    candidates.slice(0, 120).join("\n"),
    "",
    'Reply with ONLY a JSON array of up to 6 repository-relative paths, e.g. ["src/a.ts"].',
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

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class Engine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private readonly store: EngineStore;
  private readonly runner: AgentRunner;
  /** Code-writing tier (execute). Falls back to the decide runner. */
  private readonly execRunner: AgentRunner;

  constructor(
    private readonly config: EngineConfig,
    private readonly onEvent: (e: EngineEvent) => void = () => {},
    runner?: AgentRunner,
  ) {
    this.store = new EngineStore(config.statePath);
    this.runner = runner ?? defaultRunner();
    this.execRunner = config.execRunnerKind ? runnerFor(config.execRunnerKind, config.execModel) : this.runner;
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
      } else {
        await this.processTask(task);
      }
      await this.refreshReviewIssue();
    } catch (err) {
      this.emit("engine", `Tick failed: ${String(err)}`);
    } finally {
      this.busy = false;
    }
  }

  /** Pull `agent-ready` (and human-`approved`) issues from GitHub into the queue. */
  async syncIssues(label = "agent-ready"): Promise<number> {
    const fetch = async (lbl: string) =>
      (
        JSON.parse(
          await gh(
            ["issue", "list", "--repo", this.config.repo, "--label", lbl, "--state", "open", "--json", "number,title,body,labels,createdAt", "--limit", "50"],
            this.config.repoRoot,
          ),
        ) as Array<{ number: number; title: string; body: string; labels: { name: string }[]; createdAt: string }>
      )
        // Oldest first, so the engine works the backlog in the order filed.
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    let added = 0;
    const ready = await fetch(label);
    for (const issue of ready) added += this.enqueueIssue(issue, false);
    // A human `approved` label is an explicit override of the level gate.
    const approved = await fetch("approved");
    for (const issue of approved) added += this.enqueueIssue(issue, true);

    this.emit("engine", `Synced ${ready.length + approved.length} issue(s), ${added} new.`);
    return added;
  }

  private enqueueIssue(issue: { number: number; title: string; body: string; labels: { name: string }[] }, approved: boolean): number {
    const labels = issue.labels.map((l) => l.name);
    const before = this.store.list().length;
    this.store.enqueue({
      source: "github",
      repo: this.config.repo,
      issueNumber: issue.number,
      title: issue.title,
      body: issue.body,
      labels,
      requiredLevel: approved ? 0 : requiredLevelFor(labels),
      risk: approved ? "low" : riskFor(labels),
    });
    return this.store.list().length > before ? 1 : 0;
  }

  /** Rewrite a pinned issue so one link shows everything needing a human. */
  async updateReviewIssue(issueNumber: number): Promise<void> {
    const byLabel = async (l: string) =>
      JSON.parse(
        await gh(["issue", "list", "--repo", this.config.repo, "--label", l, "--state", "open", "--json", "number,title", "--limit", "50"], this.config.repoRoot),
      ) as Array<{ number: number; title: string }>;
    const [queued, gated, review] = await Promise.all([byLabel("agent-ready"), byLabel("human-gate"), byLabel("engine:review")]);
    const fmt = (xs: Array<{ number: number; title: string }>) =>
      xs.length ? xs.map((i) => `- #${i.number} ${i.title}`).join("\n") : "_none_";
    const body = [
      "<!-- jubilee-engine:auto -->",
      `_Auto-maintained by the Jubilee Engine · ${new Date().toISOString()} · autonomy L${this.config.autonomyLevel}_`,
      "",
      `### 🟣 Awaiting your review (human gate) — ${gated.length}`,
      fmt(gated),
      "",
      `### 🟢 Engine PRs awaiting review — ${review.length}`,
      fmt(review),
      "",
      `### 🔵 Queued (agent-ready) — ${queued.length}`,
      fmt(queued),
      "",
      "**Approve** a gated item by adding the `approved` label. **Give instructions** by commenting on its issue.",
      "The engine still only opens pull requests — nothing is deployed or moved.",
    ].join("\n");
    await gh(["issue", "edit", String(issueNumber), "--repo", this.config.repo, "--body", body], this.config.repoRoot);
  }

  private async refreshReviewIssue(): Promise<void> {
    if (!this.config.reviewIssue) return;
    try {
      await this.updateReviewIssue(this.config.reviewIssue);
    } catch (e: any) {
      this.emit("engine", `note: could not refresh review issue: ${String(e?.message ?? e)}`);
    }
  }

  // ---- the loop ----

  private async processTask(task: EngineTask): Promise<void> {
    this.emit("task", `▶ #${task.issueNumber ?? task.id} ${task.title}`, task.id);

    // -- Gate: autonomy + risk (held work is surfaced to the human on GitHub) --
    if (task.requiredLevel > this.config.autonomyLevel) {
      await this.block(task, `requires L${task.requiredLevel} > engine L${this.config.autonomyLevel}`);
      return;
    }
    if (task.risk === "high" || task.requiredLevel >= 3) {
      await this.block(task, "high-risk / money-adjacent — human gate required");
      return;
    }

    // -- STATE (durable): reuse contract/plan recorded by a prior run --
    let contract = "";
    let plan = "";
    let attempts = 0;
    if (task.issueNumber) {
      const ledger = await readIssueLedger(this.config.repo, task.issueNumber, LEDGER_MARKER, this.config.repoRoot);
      const json = ledger.slice(ledger.indexOf(LEDGER_MARKER) + LEDGER_MARKER.length).trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
      try {
        const saved = JSON.parse(json);
        contract = typeof saved?.contract === "string" ? saved.contract : "";
        plan = typeof saved?.plan === "string" ? saved.plan : "";
        attempts = Number(saved?.attempts ?? 0) || 0;
      } catch {
        /* no usable ledger */
      }
    }

    // -- CONTRACT (typed preamble: scope · success · constraints) --
    if (contract) {
      this.emit("task", "📜 Contract reused (state).", task.id);
    } else {
      const t0 = Date.now();
      const res = await this.runner.run(contractPrompt(task));
      contract = res.text.trim().slice(0, 1000);
      this.record(task, "contract", "ok", contract, res.costUsd, t0);
      this.emit("task", "📜 Contract set.", task.id);
    }

    // -- PLAN (reused on the first attempt only, so retries re-plan) --
    if (plan && attempts === 0) {
      this.emit("task", "🧠 Plan reused (state).", task.id);
    } else {
      const t0 = Date.now();
      let humanNotes = "";
      if (task.issueNumber) {
        humanNotes = await ghIssueComments(this.config.repo, task.issueNumber, this.config.repoRoot);
      }
      const res = await this.runner.run(planPrompt(task, humanNotes, contract));
      plan = res.text;
      this.record(task, "plan", "ok", plan.slice(0, 500), res.costUsd, t0);
      this.store.update(task.id, { status: "planned" });
      this.emit("task", "🧠 Planned.", task.id);
    }

    // Persist state so the next run doesn't re-derive it.
    if (task.issueNumber) {
      try {
        await upsertIssueLedger(
          this.config.repo,
          task.issueNumber,
          LEDGER_MARKER,
          "```json\n" + JSON.stringify({ contract, plan, attempts: attempts + 1, updatedAt: new Date().toISOString() }) + "\n```",
          this.config.repoRoot,
        );
      } catch {
        /* state is best-effort */
      }
    }

    // -- VET (typed decision: safe | ask — "ask" reaches a person) --
    {
      const t0 = Date.now();
      const d = await systemOne(
        this.runner,
        `TASK: ${task.title}\nRISK: ${task.risk}\nCONTRACT:\n${contract}`,
        [
          {
            name: "decision",
            instructions: "Is this safe to do autonomously, without touching money, keys, mainnet, deploys, or treasury?",
            criteria: "Docs, tests, mechanical edits = safe. Deletes, network, history rewrites, funds = ask.",
            options: ["safe", "ask"],
          },
        ],
      );
      const decision = d.decision;
      const blocking = decision === "ask" || (this.config.requireReview && decision !== "safe");
      this.record(task, "vet", blocking ? "fail" : "ok", `decision=${decision}`, 0, t0);
      this.emit("task", `🧭 Vet: ${decision}${blocking ? " (→ human)" : ""}`, task.id);
      if (blocking) {
        await this.block(task, `vet says "${decision}" — needs a human call`);
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

      // A git worktree shares .git but NOT untracked files like node_modules, so
      // checks would fail with "command not found". Link the repo's deps in.
      try {
        const nm = path.join(this.config.repoRoot, "node_modules");
        const link = path.join(worktree, "node_modules");
        if (fs.existsSync(nm) && !fs.existsSync(link)) fs.symlinkSync(nm, link, "dir");
      } catch {
        /* best effort — setupCommand below can still install */
      }

      // Per-repo bootstrap (e.g. install deps) before the change is made.
      if (this.config.setupCommand) {
        this.emit("task", `⚙️ setup: ${this.config.setupCommand}`, task.id);
        await runChecks(worktree, [{ name: "setup", cmd: this.config.setupCommand }], 20 * 60_000);
      }

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
        // SCORE (typed): choose the files to read, then EXECUTE on the code tier.
        let chosen: string[] = [];
        try {
          const all = await gitLsFiles(worktree);
          const named = extractPaths(plan).filter((p) => all.includes(p));
          const candidates = (named.length ? named : all).slice(0, 120);
          if (candidates.length) {
            const score = await this.runner.run(scorePrompt(task, plan, candidates));
            chosen = extractArray(score.text).filter((p) => candidates.includes(p)).slice(0, 6);
            this.emit("task", `🎯 SCORE: ${chosen.length ? chosen.join(", ") : "fallback"}`, task.id);
          }
        } catch {
          /* fall through to the regex fallback */
        }
        if (!chosen.length) chosen = extractPaths(plan).slice(0, 6);
        // Bounded recovery: up to 2 attempts; the failure is fed back to the model.
        let applied = false;
        let feedback = "";
        for (let attempt = 1; attempt <= 2 && !applied; attempt++) {
          const fileContext = readFileContext(worktree, chosen);
          const res = await this.execRunner.run(
            executePrompt(task, `${contract}\n\n${plan}`, fileContext, feedback),
            { cwd: worktree },
          );
          cost += res.costUsd;

          const patch = extractDiff(res.text);
          if (patch) {
            const pf = path.join(worktree, ".engine.patch");
            fs.writeFileSync(pf, patch);
            try {
              await applyPatch(worktree, pf);
              applied = true;
            } catch (e: any) {
              feedback = `Your diff did not apply (${String(e?.message ?? e)}). Return SEARCH/REPLACE blocks whose SEARCH lines match the file EXACTLY.`;
            } finally {
              fs.rmSync(pf, { force: true });
            }
          }
          if (!applied) {
            const edits = parseEdits(res.text);
            if (edits.length) {
              const r = applyEdits(worktree, edits);
              if (r.applied > 0) applied = true;
              else feedback = `SEARCH text did not match (${r.failed.join(", ")}). Copy the exact existing lines into SEARCH.`;
            } else {
              feedback = "No edits parsed. Return SEARCH/REPLACE blocks (or a unified diff).";
            }
          }
        }
        if (!applied) {
          this.record(task, "execute", "fail", "no applicable change after retries", cost, t0);
          this.store.update(task.id, { status: "failed", lastError: "no applicable change" });
          this.emit("task", "⚠️ No applicable change after retries.", task.id);
          return;
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
      this.emit("task", `⚠️ Execute failed: ${String(e?.message ?? e)}`, task.id);
      if (worktree) await removeWorktree(this.config.repoRoot, worktree);
      return;
    }

    // -- VERIFY (pre-gate gauntlet: checks → security scan → red-team, until clear) --
    let gauntletReport = "";
    {
      const t0 = Date.now();
      this.store.update(task.id, { status: "verifying" });
      const g = await runGauntlet({
        worktree,
        checks: this.config.checks,
        runner: this.execRunner,
        maxRounds: this.config.gauntletRounds,
        readFiles: (rels) => readFileContext(worktree, rels),
        extractPaths,
        onEvent: (m) => this.emit("task", m, task.id),
      });
      gauntletReport = g.report;
      this.record(task, "verify", g.ok ? "ok" : "fail", `gauntlet ${g.ok ? "clear" : "unresolved"} (${g.rounds} round(s))`, 0, t0);
      if (!g.ok) {
        this.store.update(task.id, { status: "failed", lastError: "gauntlet not clear" });
        this.emit("task", "🛡️ Gauntlet NOT clear — not presenting.", task.id);
        return;
      }
      this.emit("task", `🛡️ Gauntlet CLEAR after ${g.rounds} round(s).`, task.id);
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
          `Automated by Jubilee Engine (autonomy L${this.config.autonomyLevel}).\n\nCloses #${task.issueNumber ?? ""}\n\nVerified by the pre-gate gauntlet before reaching a human:\n\n${gauntletReport}\n`,
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
      this.emit("task", `⚠️ Package failed: ${String(e?.message ?? e)}`, task.id);
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

  private async block(task: EngineTask, reason: string): Promise<void> {
    this.store.update(task.id, { status: "blocked", lastError: reason });
    this.emit("task", `⏸ Held for human: ${reason}`, task.id);
    if (task.issueNumber) {
      try {
        await ghIssueLabels(this.config.repo, task.issueNumber, ["human-gate"], ["agent-ready"], this.config.repoRoot);
        await ghIssueComment(
          this.config.repo,
          task.issueNumber,
          [
            `⏸ **Held for human review** — ${reason}.`,
            "",
            `Engine autonomy: **L${this.config.autonomyLevel}** · this task needs **L${task.requiredLevel}**.`,
            "",
            "**To approve:** add the `approved` label — the engine will then work it.",
            "*(It still only opens a pull request; nothing is deployed or moved.)*",
            "**To give instructions:** comment below — the engine reads recent comments.",
          ].join("\n"),
          this.config.repoRoot,
        );
      } catch (e: any) {
        this.emit("task", `note: could not surface hold on issue #${task.issueNumber}: ${String(e?.message ?? e)}`, task.id);
      }
    }
  }

  private isKilled(): boolean {
    return fs.existsSync(this.config.killSwitchPath);
  }

  private overBudget(): boolean {
    return this.config.dailyBudgetUsd > 0 && this.store.spentToday() >= this.config.dailyBudgetUsd;
  }

  private record(
    task: EngineTask,
    stage: "contract" | "plan" | "vet" | "score" | "execute" | "verify" | "package" | "record",
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
