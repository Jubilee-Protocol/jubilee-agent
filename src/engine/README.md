# The Jubilee Engine

The Engine is Jubilee OS's **durable, supervised 24/7 build loop**. It picks work
from a queue, plans it, vets it, executes it in an isolated worktree, verifies it,
packages a PR, and records the outcome — with the human out of the inner loop but
still in the outer loop for anything consequential.

```
plan → vet → execute → verify → package → record
```

It replaces the naive `DaemonService` heartbeat (`src/services/daemon-service.ts`),
which polled chat history every 10 minutes with no queue, no isolation, no
verification, and no cost bound.

## Guarantees

| Rule | Where |
|---|---|
| Work comes from a **durable queue**, never chat history | `store.ts` |
| Every repo mutation happens in an **isolated worktree** | `git.ts`, `engine.ts` |
| Nothing packages unless **checks pass + adversarial review approves** | `verify.ts`, `engine.ts` |
| Autonomy is **capped by a level**; money/mainnet is always human-gated | `engine.ts`, `types.ts` |
| A **kill-switch file** and a **daily budget cap** bound the machine | `engine.ts` |

## Autonomy levels

| Level | Scope | Merge policy |
|---|---|---|
| 0 | propose-only | human merges all |
| 1 | docs / tests / chores | auto-merge when CI green |
| 2 | non-critical code | auto-merge when CI + adversarial review green |
| 3 | money-adjacent | **human gate required** |
| 4 | mainnet / deploys / treasury | **human gate required** |

Start at L1. Never run L3/L4 without a named human gate.

## Work source

Label GitHub issues `agent-ready`. Optionally add `level:2`, `level:3`, `level:4`
or `risk:high` to classify them; the Engine refuses anything above its own level.
`bun run src/engine/cli.ts sync` pulls them into the queue (idempotent per issue).

## Configuration (env)

| Var | Default | Purpose |
|---|---|---|
| `JUBILEE_REPO` | `Jubilee-Protocol/jubilee-agent` | target repo (owner/name) |
| `JUBILEE_REPO_ROOT` | `process.cwd()` | local clone used as the worktree base |
| `JUBILEE_AUTONOMY_LEVEL` | `1` | autonomy ceiling |
| `JUBILEE_DAILY_BUDGET_USD` | `5` | hard daily spend cap |
| `JUBILEE_CHECKS` | `typecheck=bun run typecheck; test=bun test` | verification gate |
| `JUBILEE_ADVERSARIAL` | `1` | enable independent adversarial review |
| `JUBILEE_HEARTBEAT_MINUTES` | `10` | idle cadence (event wakeups still preferred) |
| `JUBILEE_KILL_SWITCH` | `~/.jubilee/KILL` | presence ⇒ engine idles |
| `JUBILEE_ENGINE_STATE` | `~/.jubilee/engine/state.json` | durable state |
| `JUBILEE_RUNNER` | `triune` | `triune` (real agent) or `stub` (dry run) |
| `JUBILEE_HOME` | `~/.jubilee` | base dir for state/kill/worktrees |

## Operations

```bash
bun run src/engine/cli.ts status      # queue + budget + last runs
bun run src/engine/cli.ts sync        # pull agent-ready issues
bun run src/engine/cli.ts run-once    # process one task
bun run src/engine/cli.ts start       # foreground loop (use a supervisor)
bun run src/engine/cli.ts kill        # stop claiming work now
bun run src/engine/cli.ts unjail      # resume
```

Deploy under a supervisor so a crash can't silently kill the loop — see
`deploy/engine/` for launchd / systemd / Docker and `.github/workflows/engine.yml`
for the GitHub-Actions variant.

## Status: MVP

This is a first, coherent cut. Deliberate follow-ups:
1. Back the store with Postgres (`tasks` + a new `engine_runs` table) for multi-node.
2. Pass the worktree cwd into the Triune runner (today the agent runs in-process;
   set `artifacts.executeCommand` for deterministic, fully-isolated work).
3. Wire `gh pr merge --auto --squash` for L1/L2 auto-merge once CI is green.
4. Add a `protocol_state` writer so run health shows up in The Steward UI.
5. Unit tests for `store` and `verify` (the loop itself stays thin on purpose).
