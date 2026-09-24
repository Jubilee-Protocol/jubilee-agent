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

/** Create a public-safe patch artifact instead of pushing (propose-only mode). */
export async function writePatch(cwd: string, outFile: string): Promise<string> {
  const patch = await git(["diff", "HEAD"], cwd);
  fs.writeFileSync(outFile, patch);
  return outFile;
}
