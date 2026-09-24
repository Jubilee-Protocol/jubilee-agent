# Deploying the Jubilee Engine

The Engine must run under a **supervisor** so a crash can't silently stop the
24/7 loop. Pick the host that matches where you want work to happen:

| Host | File | Notes |
|---|---|---|
| macOS (this Mac) | `com.jubilee.engine.plist` | launchd, `KeepAlive` restart |
| Linux VPS | `jubilee-engine.service` | systemd, `Restart=always` |
| GitHub Actions | `../../.github/workflows/engine.yml` | cloud, no always-on box needed |
| Docker | `docker-compose.engine.yml` | `restart: unless-stopped` |

## Mixed setup (recommended)

Run the **same** engine in more than one place, but make them non-overlapping:

- **GitHub Actions** — cheap, reliable, good for L1/L2 work on a schedule and on
  `agent-ready` label events. Best default.
- **Local Mac / VPS** — for work that needs a persistent clone, secrets, or a
  long-running task. Guarded by the same kill switch and budget.

Because the file store is single-node, run **one always-on engine per repo**
(plus Actions for burst work). If you need true multi-node, move the store to
Postgres first.

## Important: Actions + GITHUB_TOKEN

PRs opened by the workflow's default `GITHUB_TOKEN` **do not trigger other
workflows**, so CI won't run on them. To get CI on engine PRs, give the workflow
a fine-grained PAT or GitHub App token instead of the default token.

## Kill switch

```bash
bun run src/engine/cli.ts kill     # engine idles immediately
bun run src/engine/cli.ts unjail   # resume
```

Presence of `~/.jubilee/KILL` is enough. Deleting it resumes.
