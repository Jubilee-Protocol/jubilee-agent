#!/usr/bin/env bun
/**
 * Jubilee Engine CLI.
 *
 *   bun run src/engine/cli.ts status
 *   bun run src/engine/cli.ts enqueue "Update README" --level 1
 *   bun run src/engine/cli.ts run-once
 *   bun run src/engine/cli.ts sync
 *   bun run src/engine/cli.ts start            # supervised foreground loop
 *   bun run src/engine/cli.ts kill | unjail
 */
import * as fs from "node:fs";
import { Engine, loadConfig } from "./engine.js";
import { EngineStore } from "./store.js";
import type { AutonomyLevel } from "./types.js";

function log(e: { at: string; type: string; message: string }): void {
  process.stdout.write(`${e.at.slice(11, 19)} [${e.type}] ${e.message}\n`);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const config = loadConfig();
  const engine = new Engine(config, log);

  switch (cmd) {
    case "status": {
      const s = engine.status();
      process.stdout.write(JSON.stringify(s, null, 2) + "\n");
      return;
    }
    case "enqueue": {
      const title = rest.find((a) => !a.startsWith("--")) ?? "";
      const levelArg = rest.find((a) => a.startsWith("--level=")) ?? "";
      const level = Number(levelArg.split("=")[1] ?? 1) as AutonomyLevel;
      if (!title) throw new Error("usage: enqueue <title> [--level=N]");
      const store = new EngineStore(config.statePath);
      const t = store.enqueue({ repo: config.repo, title, requiredLevel: level });
      process.stdout.write(`queued ${t.id} L${t.requiredLevel} — ${t.title}\n`);
      return;
    }
    case "sync": {
      await engine.syncIssues();
      return;
    }
    case "run-once": {
      await engine.tick();
      return;
    }
    case "start": {
      engine.start();
      // keep the process alive; a supervisor restarts it if it dies
      process.on("SIGINT", () => {
        engine.stop();
        process.exit(0);
      });
      process.on("SIGTERM", () => {
        engine.stop();
        process.exit(0);
      });
      await new Promise(() => {});
      return;
    }
    case "kill": {
      fs.mkdirSync(config.killSwitchPath.replace(/\/[^/]+$/, ""), { recursive: true });
      fs.writeFileSync(config.killSwitchPath, `killed ${new Date().toISOString()}\n`);
      process.stdout.write(`kill switch set: ${config.killSwitchPath}\n`);
      return;
    }
    case "unjail": {
      fs.rmSync(config.killSwitchPath, { force: true });
      process.stdout.write("kill switch cleared.\n");
      return;
    }
    default:
      process.stdout.write(
        [
          "Jubilee Engine CLI",
          "  status | enqueue <title> [--level=N] | sync | run-once | start | kill | unjail",
          "",
        ].join("\n"),
      );
  }
}

main().catch((e) => {
  process.stderr.write(`engine cli error: ${String(e?.message ?? e)}\n`);
  process.exit(1);
});
