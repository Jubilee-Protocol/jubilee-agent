/**
 * Jubilee Engine — robust edit application.
 *
 * Small/local models are bad at unified diffs but good at "replace these exact
 * lines with those". This parses Aider-style SEARCH/REPLACE blocks and applies
 * them, tolerating whitespace drift, so the loop can actually finish a task
 * without a frontier model.
 *
 * Format:
 *   path/to/file.ts
 *   <<<<<<< SEARCH
 *   <exact existing lines>
 *   =======
 *   <replacement lines>
 *   >>>>>>> REPLACE
 */
import * as fs from "node:fs";
import * as path from "node:path";

export interface EditBlock {
  file: string;
  search: string;
  replace: string;
}

const FILE_LINE = /^[`*\s]*([\w./-]+\.\w+)[`*\s]*$/;

/** Parse SEARCH/REPLACE blocks, using the nearest preceding path line as the file. */
export function parseEdits(text: string): EditBlock[] {
  const lines = text.split("\n");
  const blocks: EditBlock[] = [];
  let pendingFile = "";

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "<<<<<<< SEARCH") {
      const search: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "=======") {
        search.push(lines[i]);
        i++;
      }
      const replace: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ">>>>>>> REPLACE") {
        replace.push(lines[i]);
        i++;
      }
      if (pendingFile) blocks.push({ file: pendingFile, search: search.join("\n"), replace: replace.join("\n") });
      continue;
    }
    if (t && !t.startsWith("```")) {
      const m = t.match(FILE_LINE);
      if (m) pendingFile = m[1];
    }
  }
  return blocks;
}

export interface ApplyResult {
  applied: number;
  failed: string[];
}

/** Apply edit blocks in the worktree. Exact match first, then trimmed (fuzz). */
export function applyEdits(worktree: string, blocks: EditBlock[]): ApplyResult {
  let applied = 0;
  const failed: string[] = [];

  for (const b of blocks) {
    const abs = path.join(worktree, b.file);
    if (!abs.startsWith(worktree)) {
      failed.push(b.file);
      continue;
    }
    let content: string;
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      failed.push(b.file);
      continue;
    }

    let next: string | null = null;
    if (b.search && content.includes(b.search)) {
      next = content.replace(b.search, b.replace);
    } else if (b.search && content.includes(b.search.trim())) {
      next = content.replace(b.search.trim(), b.replace.trim());
    } else if (!b.search) {
      // No SEARCH = new file (or append).
      next = content + b.replace;
    }

    if (next === null) {
      failed.push(b.file);
      continue;
    }
    fs.writeFileSync(abs, next);
    applied++;
  }
  return { applied, failed };
}
