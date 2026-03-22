# Agent Department Map

> Maps each angel to a department, preferred model backend, and MCP servers.
> Used by `dispatch_angel` to auto-route tools and resources.

## Org Chart

```
┌─────────────────────────────────────────────────────────────────┐
│                    JUBILEE OS — ANGEL HOSTS                     │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│ Engineering  │ Architecture │ Marketing/BD │ Tokenomics        │
│              │              │              │                   │
│ ContractAngel│ DocsAngel    │ GrowthAngel  │ TreasuryAngel     │
│ BuilderAngel │ ComplianceA. │ SocialAngel  │ ResearchAngel     │
│ SystemAngel  │              │ CommunityA.  │ TokenAngel        │
├──────────────┴──────┬───────┴──────────────┴───────────────────┤
│ Governance          │ Pastoral                                 │
│ GovernanceAngel     │ PastoralAngel                            │
└─────────────────────┴──────────────────────────────────────────┘
```

## Department → MCP Server Mapping

| Department | MCP Servers | Notes |
|------------|------------|-------|
| Engineering | `openclaw`, `github` | Shell exec, git operations |
| Architecture | `openclaw`, `github` | Code review, doc gen |
| Marketing/BD | `coingecko`, `coinmarketcap` | Market data for content |
| Tokenomics | `coingecko`, `dune`, `helius` | On-chain analytics, Solana |
| Governance | `openclaw`, `github` | Proposals, multi-sig |
| Pastoral | — | Bible tools, memory only |

## Angel → Department → Model

| Angel | Department | Preferred Model | Key Capabilities |
|-------|-----------|-----------------|------------------|
| ContractAngel | Engineering | claude | code_exec, search_codebase, skill |
| BuilderAngel | Engineering | claude | code_exec, search_codebase, skill |
| SystemAngel | Engineering | claude | code_exec, search_codebase |
| DocsAngel | Architecture | claude | web_search, browser, recall_memories |
| ComplianceAngel | Architecture | claude | web_search, read_filings |
| GrowthAngel | Marketing/BD | gemini | web_search, draft_email |
| SocialAngel | Marketing/BD | gemini | web_search, draft_email, skill |
| CommunityAngel | Marketing/BD | gemini | web_search, draft_email |
| TreasuryAngel | Tokenomics | gemini | financial_search, financial_metrics, skill |
| ResearchAngel | Tokenomics | gemini | financial_search, web_search, browser |
| TokenAngel | Tokenomics | gemini | financial_search, financial_metrics |
| GovernanceAngel | Governance | claude | propose_safe_tx, query_safe_status |
| PastoralAngel | Pastoral | gemini | bible_lookup, recall_memories, draft_email |
