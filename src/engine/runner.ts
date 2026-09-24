/**
 * Jubilee Engine — agent runners.
 *
 * The Engine talks to models through a tiny interface so the loop stays
 * testable and model-agnostic. The default runner delegates to Jubilee's
 * existing Triune agent (AgentService → Mind/Prophet/Will). Set
 * JUBILEE_RUNNER=stub for a model-free dry run.
 */
export interface RunResult {
  text: string;
  costUsd: number;
}

export interface AgentRunner {
  run(prompt: string, opts?: { cwd?: string }): Promise<RunResult>;
}

/** Delegates to the in-repo Triune agent. */
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

/** A no-op runner for dry runs and CI. */
export class StubRunner implements AgentRunner {
  constructor(private readonly reply = "[stub] model not configured") {}

  async run(): Promise<RunResult> {
    return { text: this.reply, costUsd: 0 };
  }
}

export function defaultRunner(): AgentRunner {
  const kind = process.env.JUBILEE_RUNNER ?? "triune";
  if (kind === "stub") return new StubRunner();
  return new TriuneRunner(Number(process.env.JUBILEE_COST_PER_CALL_USD ?? 0));
}
