/**
 * Jubilee Engine — git / GitHub helpers.
 *
 * All repo mutations happen in an isolated git worktree so a rogue run can
 * never dirty the main checkout. Pushes and PRs go through the `gh` CLI,
 * which respects the operator's existing GitHub auth.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";

const run = promisify(execFile);
const MAXBUF = 32 * 1024 * 1024;

export async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await run("git", args, { cwd, maxBuffer: MAXBUF });
  return stdout.trim();
}

export async function gh(args: string[], cwd: string): Promise<string> {
  const { stdout } = await run("gh", args, { cwd, maxBuffer: MAXBUF });
  return stdout.trim();
}

/** Create an isolated worktree on a fresh branch from HEAD. Returns its path. */
export async function createWorktree(repoRoot: string, branch: string, workRoot: string): Promise<string> {
  fs.mkdirSync(workRoot, { recursive: true });
  const dir = path.join(workRoot, branch.replace(/[^a-zA-Z0-9._-]/g, "-"));
  await git(["worktree", "add", "-B", branch, dir, "HEAD"], repoRoot);
  return dir;
}

export async function removeWorktree(repoRoot: string, dir: string): Promise<void> {
  try {
    await git(["worktree", "remove", "--force", dir], repoRoot);
  } catch {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export async function diffStat(cwd: string): Promise<string> {
  return git(["diff", "--stat", "HEAD"], cwd);
}

export async function hasChanges(cwd: string): Promise<boolean> {
  return (await git(["status", "--porcelain"], cwd)).length > 0;
}

export async function commitAll(cwd: string, message: string): Promise<string> {
  await git(["add", "-A"], cwd);
  await git(["commit", "-m", message, "--no-verify"], cwd);
  return git(["rev-parse", "HEAD"], cwd);
}

export async function pushBranch(cwd: string, branch: string): Promise<void> {
  await git(["push", "-u", "origin", branch], cwd);
}

export async function openPr(cwd: string, title: string, body: string): Promise<string> {
  return gh(["pr", "create", "--title", title, "--body", body], cwd);
}

/** Apply a unified diff inside the worktree, with graceful fallbacks. */
export async function applyPatch(cwd: string, patchFile: string): Promise<void> {
  try {
    await git(["apply", "--whitespace=nowarn", patchFile], cwd);
    return;
  } catch {
    /* try harder below */
  }
  try {
    await git(["apply", "-3", "--whitespace=nowarn", patchFile], cwd);
    return;
  } catch {
    /* fall through */
  }
  // Last resort: GNU patch tolerates more whitespace/fuzz.
  await run("patch", ["-p1", "--forward", "--batch", "-i", patchFile], { cwd, maxBuffer: MAXBUF });
}

/** Create a public-safe patch artifact instead of pushing (propose-only mode). */
export async function writePatch(cwd: string, outFile: string): Promise<string> {
  // Stage everything so *untracked* files are included, then diff against HEAD.
  await git(["add", "-A"], cwd);
  const patch = await git(["diff", "--cached", "HEAD"], cwd);
  fs.writeFileSync(outFile, patch);
  return outFile;
}

/** Comment on an issue (used to surface held/gated work to a human). */
export async function ghIssueComment(repo: string, num: number, body: string, cwd: string): Promise<void> {
  await gh(["issue", "comment", String(num), "--repo", repo, "--body", body], cwd);
}

/** Add/remove labels on an issue. */
export async function ghIssueLabels(
  repo: string,
  num: number,
  add: string[],
  remove: string[],
  cwd: string,
): Promise<void> {
  const args = ["issue", "edit", String(num), "--repo", repo];
  for (const l of add) args.push("--add-label", l);
  for (const l of remove) args.push("--remove-label", l);
  await gh(args, cwd);
}

/** Recent human comments on an issue — so feedback can shape the work. */
export async function ghIssueComments(repo: string, num: number, cwd: string): Promise<string> {
  try {
    return await gh(["issue", "view", String(num), "--repo", repo, "--json", "comments", "--jq", ".comments[].body"], cwd);
  } catch {
    return "";
  }
}

/** Ensure a local clone of `repo` exists at `dir` (multi-repo mode). */
export async function ensureClone(repo: string, dir: string, cwd: string): Promise<string> {
  if (fs.existsSync(path.join(dir, ".git"))) {
    try {
      await git(["fetch", "--prune", "origin"], dir);
      await git(["checkout", "--force", "origin/HEAD"], dir);
    } catch {
      /* offline is fine — work from whatever we have */
    }
    return dir;
  }
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  await gh(["repo", "clone", repo, dir], cwd);
  return dir;
}

/** Tracked files in a worktree (used to pick what the model should read). */
export async function gitLsFiles(cwd: string): Promise<string[]> {
  const out = await git(["ls-files"], cwd);
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
