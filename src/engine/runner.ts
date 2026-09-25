/**
 * Jubilee Engine — agent runners.
 *
 * The Engine talks to models through a tiny interface so the loop stays
 * testable and model-agnostic.
 *
 *   JUBILEE_RUNNER=openrouter  → headless OpenRouter call (recommended for a daemon)
 *   JUBILEE_RUNNER=triune      → delegate to the in-repo Triune agent (AgentService)
 *   JUBILEE_RUNNER=stub        → model-free dry run (auto-approves; use --exec tasks)
 */
export interface RunResult {
  text: string;
  costUsd: number;
}

export interface AgentRunner {
  run(prompt: string, opts?: { cwd?: string }): Promise<RunResult>;
}

/** Headless OpenRouter runner — no CLI, DB, or settings dependency. */
export class OpenRouterRunner implements AgentRunner {
  private readonly model: string;
  private readonly apiKey: string;

  constructor(
    model = process.env.JUBILEE_MODEL ?? "anthropic/claude-3.5-sonnet",
    apiKey = process.env.OPENROUTER_API_KEY ?? "",
  ) {
    this.model = model.replace(/^openrouter\//, "");
    this.apiKey = apiKey;
  }

  async run(prompt: string): Promise<RunResult> {
    if (!this.apiKey) throw new Error("OPENROUTER_API_KEY is not set");
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://jubileeprotocol.xyz",
        "X-Title": "Jubilee Engine",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = (await res.json()) as any;
    const text = json?.choices?.[0]?.message?.content ?? "";
    const costUsd = Number(json?.usage?.total_cost ?? json?.usage?.cost ?? 0) || 0;
    return { text, costUsd };
  }
}

/** Delegates to the in-repo Triune agent (Mind/Prophet/Will). */
export class TriuneRunner implements AgentRunner {
  constructor(private readonly costPerCallUsd = 0) {}

  async run(prompt: string): Promise<RunResult> {
    try {
      const { AgentService } = await import("../services/agent-service.js");
      const text = await AgentService.getInstance().chat(prompt);
      return { text, costUsd: this.costPerCallUsd };
    } catch (e: any) {
      throw new Error(`TriuneRunner failed to invoke AgentService: ${String(e?.message ?? e)}`);
    }
  }
}

/** Model-free dry run. Auto-approves so the pipeline can be exercised end-to-end. */
export class StubRunner implements AgentRunner {
  constructor(private readonly reply = "APPROVE — stub dry run: no model configured") {}

  async run(): Promise<RunResult> {
    return { text: this.reply, costUsd: 0 };
  }
}

/** Local Ollama runner — free, offline, no API key. Great for a 24/7 loop. */export class OllamaRunner implements AgentRunner {
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(
    model = process.env.JUBILEE_MODEL ?? "spark-x2.5:1.7b",
    baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  ) {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async run(prompt: string): Promise<RunResult> {
    const timeoutMs = Number(process.env.JUBILEE_MODEL_TIMEOUT_MS ?? 300_000);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          options: { temperature: 0.2 },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const json = (await res.json()) as any;
      return { text: json?.message?.content ?? "", costUsd: 0 };
    } catch (e: any) {
      if (e?.name === "AbortError") throw new Error(`Ollama model call timed out after ${timeoutMs}ms`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** GitHub Models runner — free inference using the Actions built-in GITHUB_TOKEN. */
export class GitHubModelsRunner implements AgentRunner {
  private readonly model: string;
  private readonly token: string;

  constructor(
    model = process.env.JUBILEE_MODEL ?? "openai/gpt-4o-mini",
    token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "",
  ) {
    this.model = model;
    this.token = token;
  }

  async run(prompt: string): Promise<RunResult> {
    if (!this.token) throw new Error("GITHUB_TOKEN is not set (needed for GitHub Models)");
    const res = await fetch("https://models.github.ai/inference/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(`GitHub Models ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = (await res.json()) as any;
    const text = json?.choices?.[0]?.message?.content ?? "";
    return { text, costUsd: 0 };
  }
}

export function defaultRunner(): AgentRunner {
  const kind = process.env.JUBILEE_RUNNER ?? "triune";
  if (kind === "stub") return new StubRunner();
  if (kind === "ollama") return new OllamaRunner();
  if (kind === "github-models" || kind === "github") return new GitHubModelsRunner();
  if (kind === "openrouter") return new OpenRouterRunner();
  return new TriuneRunner(Number(process.env.JUBILEE_COST_PER_CALL_USD ?? 0));
}
