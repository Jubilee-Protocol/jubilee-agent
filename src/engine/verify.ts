/**
 * Jubilee Engine — verification gate.
 *
 * Nothing is packaged unless every configured check passes in the worktree.
 * This is deliberately boring and deterministic: tests, typecheck, lint,
 * security scan. An adversarial reviewer (see engine.ts) runs *in addition*.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { VerifyCheck } from "./types.js";

const run = promisify(execFile);

export interface CheckResult {
  name: string;
  ok: boolean;
  output: string;
}

export async function runChecks(
  cwd: string,
  checks: VerifyCheck[],
  timeoutMs = 15 * 60_000,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    try {
      const { stdout, stderr } = await run("bash", ["-lc", check.cmd], {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
      });
      results.push({ name: check.name, ok: true, output: (stdout + stderr).slice(-8000) });
    } catch (e: any) {
      results.push({
        name: check.name,
        ok: false,
        output: (String(e?.stdout ?? "") + String(e?.stderr ?? "") + String(e?.message ?? e)).slice(-8000),
      });
    }
  }
  return results;
}

export function allPassed(results: CheckResult[]): boolean {
  return results.length > 0 && results.every((r) => r.ok);
}

export function summarize(results: CheckResult[]): string {
  return results.map((r) => `${r.ok ? "✅" : "❌"} ${r.name}`).join(" · ");
}
