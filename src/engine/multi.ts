/**
 * Jubilee Engine — multi-repo driver.
 *
 * When `JUBILEE_REPOS` is set (comma-separated `owner/name`), the engine clones
 * each repo and runs one tick per repo. Otherwise it runs the single target.
 *
 * Per-repo checks can be overridden with `JUBILEE_CHECKS_<SLUG>` (slug = repo
 * with non-alphanumerics collapsed to `__`, uppercased) — e.g. a Solidity repo's
 * `JUBILEE_CHECKS_JUBILEE__PROTOCOL__JUSDI="test=forge test"`.
 */
import * as path from "node:path";
import { Engine, loadConfig, parseChecks } from "./engine.js";
import { ensureClone } from "./git.js";
import type { EngineConfig, EngineEvent } from "./types.js";

export function reposFromEnv(primary: string): string[] {
  const list = (process.env.JUBILEE_REPOS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : [primary];
}

export function slugFor(repo: string): string {
  return repo.replace(/[^a-zA-Z0-9]+/g, "__");
}

/**
 * Run one tick against each configured repo. Never throws: a repo that fails is
 * reported and the loop moves on, so one broken target can't stop the others.
 */
export async function runMulti(
  onEvent: (e: EngineEvent) => void,
  partial?: Partial<EngineConfig>,
): Promise<void> {
  const base = loadConfig(partial);
  const repos = reposFromEnv(base.repo);

  for (const repo of repos) {
    const slug = slugFor(repo);
    try {
      let cfg: EngineConfig = { ...base, repo };
      if (repo !== base.repo) {
        const dir = path.join(base.workRoot, "repos", slug);
        await ensureClone(repo, dir, base.repoRoot);
        cfg = { ...cfg, repoRoot: dir };
      }
      const perRepo = process.env[`JUBILEE_CHECKS_${slug.toUpperCase()}`];
      if (perRepo) cfg = { ...cfg, checks: parseChecks(perRepo) };
      const perRepoSetup = process.env[`JUBILEE_SETUP_${slug.toUpperCase()}`];
      if (perRepoSetup) cfg = { ...cfg, setupCommand: perRepoSetup };

      onEvent({
        type: "engine",
        message: `▶ ${repo} · checks: ${cfg.checks.map((c) => c.name).join(", ")}`,
        at: new Date().toISOString(),
      });
      await new Engine(cfg, onEvent).tick();
    } catch (err: any) {
      onEvent({
        type: "engine",
        message: `repo ${repo} failed: ${String(err?.message ?? err)}`,
        at: new Date().toISOString(),
      });
    }
  }
}
