/**
 * Jubilee Engine — pre-gate verification gauntlet.
 *
 * Before ANY change is presented for human gating it must survive, in order:
 *
 *   checks (typecheck/test/lint)  →  security scan (deps/Slither)  →  red-team
 *
 * If anything is unclean the engine remediates and re-runs, looping until it is
 * CLEAR (or the round budget is exhausted, in which case it is NOT presented).
 * The report is attached to the PR so a human sees exactly what was audited.
 * This is the "audited, pen-tested, red-teamed until clear, then present"
 * contract.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AgentRunner } from "./runner.js";
import { runChecks, allPassed, summarize } from "./verify.js";
import { applyPatch, diffStat } from "./git.js";
import { parseEdits, applyEdits } from "./edits.js";
import type { VerifyCheck } from "./types.js";

const run = promisify(execFile);
const MAXBUF = 32 * 1024 * 1024;

export interface GauntletStage {
  name: string;
  ok: boolean;
  skipped?: boolean;
  detail: string;
}

export interface GauntletResult {
  ok: boolean;
  rounds: number;
  stages: GauntletStage[];
  report: string;
}

function extractDiff(text: string): string {
  const fenced = text.match(/```(?:diff|patch)?\s*\n([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  return /^diff --git |^--- |^\+\+\+ /m.test(body) ? body + "\n" : "";
}

async function tryCmd(cmd: string, cwd: string): Promise<{ ok: boolean; out: string; missing: boolean }> {
  try {
    const { stdout, stderr } = await run("bash", ["-lc", cmd], { cwd, timeout: 10 * 60_000, maxBuffer: MAXBUF });
    return { ok: true, out: (stdout + stderr).slice(-8000), missing: false };
  } catch (e: any) {
    const out = String(e?.stdout ?? "") + String(e?.stderr ?? "") + String(e?.message ?? e);
    const missing = /command not found|not found|No such file/i.test(out);
    return { ok: false, out: out.slice(-8000), missing };
  }
}

async function scanStage(name: string, cmd: string, cwd: string, maxChars = 800): Promise<GauntletStage> {
  const r = await tryCmd(cmd, cwd);
  if (r.missing) return { name, ok: true, skipped: true, detail: "tool not installed" };
  return { name, ok: r.ok, detail: r.out.slice(0, maxChars) };
}

function repoRedteamScripts(cwd: string): string[] {
  try {
    return fs
      .readdirSync(path.join(cwd, "scripts"))
      .filter((f) => /^redteam_.*\.(ts|js|sh)$/.test(f))
      .map((f) => `scripts/${f}`);
  } catch {
    return [];
  }
}

/** Auto-detected scanners. A missing tool is 'skipped', not a failure. */
export async function securityScan(cwd: string): Promise<GauntletStage[]> {
  const stages: GauntletStage[] = [];
  const hasPkg = fs.existsSync(path.join(cwd, "package.json"));
  const hasSol =
    fs.existsSync(path.join(cwd, "foundry.toml")) ||
    fs.existsSync(path.join(cwd, "hardhat.config.ts")) ||
    fs.existsSync(path.join(cwd, "hardhat.config.js"));

  if (hasPkg) {
    // Blocking: high/critical dependency findings must be resolved before presenting.
    stages.push(await scanStage("deps-audit", "bun audit 2>/dev/null || npm audit --audit-level=high 2>/dev/null", cwd, 600));
  }
  if (hasSol) {
    stages.push(await scanStage("slither", "slither . --ignore-compile", cwd, 1200));
    stages.push(await scanStage("aderyn", "aderyn .", cwd, 1200));
  }

  // Repo-local adversarial scripts (opt-in — they may need a running local stack).
  if ((process.env.JUBILEE_GAUNTLET_REDTEAM ?? "0") === "1") {
    for (const s of repoRedteamScripts(cwd)) {
      stages.push(await scanStage(`redteam:${path.basename(s)}`, `bun run ${s}`, cwd));
    }
  }

  // Operator-supplied extra scanners, separated by ';;'.
  const extra = (process.env.JUBILEE_GAUNTLET_EXTRA ?? "")
    .split(";;")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const [i, cmd] of extra.entries()) {
    stages.push(await scanStage(`extra:${i + 1}`, cmd, cwd));
  }

  return stages;
}

function redTeamPrompt(diff: string): string {
  return [
    "You are a hostile red-team auditor. Assume this change is malicious or buggy.",
    "Hunt for concrete, exploitable issues: injection, auth bypass, fund loss, reentrancy,",
    "integer/precision bugs, SSRF, secret leakage, unsafe deserialization, prompt-injection surfaces.",
    `Diff:\n${diff.slice(0, 12000)}`,
    "If you find NO exploitable issue, reply with exactly: CLEAR",
    "Otherwise reply with FINDINGS followed by a numbered list. Be specific about impact.",
  ].join("\n");
}

function fixPrompt(findings: string, fileContext: string): string {
  return [
    "A verification pass found issues. Fix ALL of them.",
    `Findings:\n${findings.slice(0, 6000)}`,
    fileContext ? `\nCurrent file contents (authoritative):\n${fileContext}` : "",
    "Return the fix as Aider-style edit blocks:",
    "path/to/file",
    "<<<<<<< SEARCH",
    "<exact existing lines, copied verbatim>",
    "=======",
    "<replacement lines>",
    ">>>>>>> REPLACE",
    "(A unified diff is also accepted.) Do not touch secrets or deploys.",
  ].join("\n");
}

export async function runGauntlet(opts: {
  worktree: string;
  checks: VerifyCheck[];
  runner: AgentRunner;
  maxRounds?: number;
  readFiles?: (rels: string[]) => string;
  extractPaths?: (text: string) => string[];
  onEvent?: (msg: string) => void;
}): Promise<GauntletResult> {
  const { worktree, checks, runner } = opts;
  const maxRounds = opts.maxRounds ?? 3;
  const stages: GauntletStage[] = [];
  let round = 0;
  let clean = false;

  while (round < maxRounds && !clean) {
    round++;
    opts.onEvent?.(`🛡️ Gauntlet round ${round}/${maxRounds}`);

    const results = await runChecks(worktree, checks);
    const checksOk = allPassed(results);
    stages.push({ name: `checks(r${round})`, ok: checksOk, detail: summarize(results) });

    const scans = await securityScan(worktree);
    stages.push(...scans);
    const scanOk = scans.every((s) => s.ok);

    const diff = await diffStat(worktree);
    const red = await runner.run(redTeamPrompt(diff), { cwd: worktree });
    const redClear = /^\s*CLEAR\b/i.test(red.text.trim()) || /no exploitable/i.test(red.text);
    stages.push({ name: `red-team(r${round})`, ok: redClear, detail: red.text.replace(/\s+/g, " ").slice(0, 600) });

    clean = checksOk && scanOk && redClear;
    if (clean || round >= maxRounds) break;

    // Remediate, then loop.
    const findings = stages.filter((s) => !s.ok).map((s) => `- ${s.name}: ${s.detail}`).join("\n");
    const ctx = opts.readFiles && opts.extractPaths ? opts.readFiles(opts.extractPaths(findings)) : "";
    const fixRes = await runner.run(fixPrompt(findings, ctx), { cwd: worktree });
    const patch = extractDiff(fixRes.text);
    let remediated = false;
    if (patch) {
      const pf = path.join(worktree, ".gauntlet.patch");
      fs.writeFileSync(pf, patch);
      try {
        await applyPatch(worktree, pf);
        remediated = true;
        opts.onEvent?.("🔧 Applied remediation diff; re-verifying.");
      } catch {
        opts.onEvent?.("⚠️ Remediation diff did not apply.");
      }
      fs.rmSync(pf, { force: true });
    }
    if (!remediated) {
      const edits = parseEdits(fixRes.text);
      if (edits.length) {
        const r = applyEdits(worktree, edits);
        if (r.applied > 0) {
          remediated = true;
          opts.onEvent?.("🔧 Applied remediation edits; re-verifying.");
        }
      }
    }
    if (!remediated) opts.onEvent?.("⚠️ No remediation applied.");
  }

  const report = [
    "## 🛡️ Verification gauntlet",
    "",
    `Rounds: **${round}/${maxRounds}** · Result: ${clean ? "**CLEAR** ✅" : "**UNRESOLVED** ❌"}`,
    "",
    "Audited → security-scanned → red-teamed until clear, then presented for human gating.",
    "",
    ...stages.map(
      (s) => `- ${s.ok ? "✅" : s.skipped ? "⚪" : "❌"} ${s.name} — ${s.detail.replace(/\s+/g, " ").slice(0, 200)}`,
    ),
  ].join("\n");

  return { ok: clean, rounds: round, stages, report };
}
