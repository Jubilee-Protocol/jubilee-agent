# The Jubilee Engine — design

> Goal: let Jubilee OS **build and operate the protocol 24/7**, with the human out
> of the inner loop but still in the outer loop for anything consequential.

## Status

MVP committed on local branch `feat/jubilee-engine` (not pushed) and transpile-checked.
Not yet executed — this Mac has no `bun`/deps installed. See README's "Status: MVP".

## Why

`src/services/daemon-service.ts` ("Holy Spirit Daemon") already fires a heartbeat
every 10 minutes, but it is a naive primitive:

- it asks the model "any pending tasks?" against **in-memory chat history** — no queue;
- there is **no build loop** (nothing picks an issue → branches → codes → tests → PRs);
- code runs **on the host**, not in isolation;
- tests/typecheck exist but are **not enforced** by the loop;
- `setInterval` in-process means **a crash stops the loop**;
- the budget tracker is **per-sprint**, not a global cap;
- no **kill switch**.

The Engine fills exactly that gap.

## The loop

```
plan → vet → execute → verify → package → record
```

| Stage | What happens | Guard |
|---|---|---|
| **plan** | Mind turns the issue into a concrete spec | — |
| **vet** | Prophet returns APPROVE/REJECT on scope + safety | rejects money/keys/mainnet |
| **execute** | Will makes the change in an **isolated git worktree** | worktree isolation |
| **verify** | `JUBILEE_CHECKS` must all pass, then an **independent adversarial reviewer** must APPROVE | two independent gates |
| **package** | commit + push + open PR (or write a patch in L0) | branch + PR, never direct to `main` |
| **record** | run ledger + cost + outcome | auditable |

## Autonomy levels

| Level | Scope | Merge policy |
|---|---|---|
| 0 | propose-only | human merges all |
| 1 | docs / tests / chores | auto-merge when CI green |
| 2 | non-critical code | auto-merge when CI + adversarial review green |
| 3 | money-adjacent | **human gate required** |
| 4 | mainnet / deploys / treasury | **human gate required** |

Label issues to classify them: `agent-ready`, plus optional `level:2/3/4` or
`risk:high`. The Engine refuses any task whose required level is above its own.

## Boundaries (non-negotiable)

- **Kill switch**: presence of `~/.jubilee/KILL` ⇒ engine idles immediately.
- **Daily budget cap**: `JUBILEE_DAILY_BUDGET_USD`; over cap ⇒ engine idles.
- **No secrets / no `mainnet` / no treasury** without a human token.
- **Worktree isolation** for every mutation; `main` is protected.
- **Full ledger**: every run's stage, status, cost, and outcome is recorded.

## Deployment (mixed)

- **GitHub Actions** (`.github/workflows/engine.yml`): scheduled + label-triggered, cheap.
- **Local Mac** (`deploy/engine/com.jubilee.engine.plist`): launchd, `KeepAlive`.
- **VPS** (`deploy/engine/jubilee-engine.service`): systemd, `Restart=always`.

Run **one always-on engine per repo**; use Actions for burst work. Move the store
to Postgres before multi-node.

## Files

```
src/engine/
  types.ts     # autonomy levels, task/run/event types
  store.ts     # durable queue + run ledger (atomic JSON; Postgres-ready)
  git.ts       # worktree + gh (branch/PR/patch)
  verify.ts    # verification gate (checks)
  runner.ts    # model-agnostic agent runner (Triune or stub)
  engine.ts    # the loop
  cli.ts       # status | enqueue | sync | run-once | start | kill | unjail
  README.md    # ops reference
deploy/engine/ # supervisors
.github/workflows/engine.yml
```

## Verification gauntlet (pre-gate)

Nothing is presented for human gating until it survives, in order:

1. **Checks** — typecheck, tests, lint (`JUBILEE_CHECKS`).
2. **Security scan** — dependency audit (blocking on high/critical), plus
   **Slither** and **Aderyn** when Solidity/Foundry is detected. Missing tools
   report as skipped, never as a false pass.
3. **Adversarial red-team** — a hostile pass hunting injection, auth bypass,
   fund loss, reentrancy, precision bugs, SSRF, and secret leakage.
4. **Loop until CLEAR** — on findings the engine remediates and re-runs, up to
   `JUBILEE_GAUNTLET_ROUNDS` (default 3). **Unresolved work is not presented.**

The gauntlet report is embedded in the PR body so a reviewer sees what was audited.

Optional: `JUBILEE_GAUNTLET_REDTEAM=1` runs repo `scripts/redteam_*` scripts;
`JUBILEE_GAUNTLET_EXTRA` adds custom scanners (`;;`-separated).

## Human review & steering

The GitHub issue tracker is the control surface:

| Label | Meaning |
|---|---|
| `agent-ready` | queued for the engine |
| `human-gate` | held — needs a human decision |
| `approved` | human authorization; the engine proceeds (still PR-only) |
| `engine:review` | work finished, PR open |

When the engine holds an L3/L4 (or high-risk) task it **comments on the issue and
relabels it `human-gate`** — so gated work persists and is reviewable even though
the cloud queue is ephemeral. Approve by adding `approved`; give instructions by
commenting (recent comments are injected into the plan stage).

A pinned issue (`JUBILEE_REVIEW_ISSUE`) is auto-rewritten each tick to list
everything gated, queued, and awaiting review.

## Roadmap

1. Postgres-backed store (`tasks` + `engine_runs`) for multi-node.
2. Pass the worktree cwd into the agent runner (today the Triune agent runs
   in-process; use `artifacts.executeCommand` for fully-isolated deterministic work).
3. `gh pr merge --auto --squash` for L1/L2 once CI is green.
4. `protocol_state` writer so engine health shows up in The Steward UI.
5. Tests for `store` + `verify`; a replayable run log.
