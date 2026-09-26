/**
 * Jubilee Engine — typed decisions ("Jev" pattern).
 *
 * Most turns in a coding loop are decisions, not code. Asking a frontier model
 * to answer them in prose re-reads a huge context and costs dollars; asking a
 * *typed* question with a small answer space is cheap and bounded. `systemOne`
 * issues one call and returns a validated answer per question — failing safe to
 * the first option the caller listed.
 *
 * See: https://zodchiii — "Jev Engineering for Coding Agents".
 */
import type { AgentRunner } from "./runner.js";

export interface Question {
  /** Key in the returned object. */
  name: string;
  /** What to decide, in one line. */
  instructions: string;
  /** Optional decision criteria. */
  criteria?: string;
  /** The small answer space. Put the safe default FIRST (used on parse failure). */
  options: string[];
}

export type Decisions = Record<string, string>;

/** Pull the first JSON object out of a model reply (fenced or raw). */
function extractObject(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return {};
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return {};
  }
}

/** Pull the first JSON array out of a model reply. */
export function extractArray(text: string): string[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(body.slice(start, end + 1));
    return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/**
 * One typed decision call: `state` + `questions` → one validated value per
 * question. Unknown/blank answers fall back to each question's first option.
 */
export async function systemOne(
  runner: AgentRunner,
  state: string,
  questions: Question[],
): Promise<Decisions> {
  const shape = Object.fromEntries(questions.map((q) => [q.name, q.options[0]]));
  const prompt = [
    "You are a decision function. Answer with ONE JSON object and nothing else.",
    "",
    "STATE:",
    state.slice(0, 8000),
    "",
    "QUESTIONS (choose one allowed value for each):",
    ...questions.map(
      (q) =>
        `- "${q.name}": ${q.instructions}${q.criteria ? ` Criteria: ${q.criteria}` : ""} Allowed: ${q.options.join(" | ")}`,
    ),
    "",
    `Reply exactly like ${JSON.stringify(shape)} with your chosen values. No prose, no markdown.`,
  ].join("\n");

  const res = await runner.run(prompt);
  const raw = extractObject(res.text);
  const out: Decisions = {};
  for (const q of questions) {
    const value = String(raw?.[q.name] ?? "").trim().toLowerCase();
    const match = q.options.find((o) => o.toLowerCase() === value);
    out[q.name] = match ?? q.options[0];
  }
  return out;
}
