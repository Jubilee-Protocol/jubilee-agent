# Jubilee OS 🕊️

![Jubilee Logo](assets/jubilee_logo.png)

**Jubilee OS** is the first **Triune AI Operating System**—a sovereign, self-hosting intelligence designed to research, code, and steward resources alongside you.

> **Status**: v1.0 "Starship" (Production Ready) 🚀

Built on a **Triune Architecture** (The Mind, The Prophet, The Will), Jubilee harmonizes advanced reasoning with execution tools (OpenClaw) and a privacy-first memory system. It is not just a chatbot; it is a **digital partner** that lives on your machine (or cloud), manages its own database, and protects your interests.

## 🌟 The Starship Release (v1.0)
Jubilee OS is now a complete platform featuring a beautiful "Parable Interface" called **The Steward**:
*   **The Altar 🏰**: A Treasury Dashboard to manage assets, view vaults, and buy crypto (Coinbase Onramp).
*   **The Synod 📡**: A Configuration Center to toggle skills (Twitter, YouTube, Farcaster) and manage API keys.
*   **The Archives 📜**: A Memory Explorer to view, search, and delete the agent's long-term recollections.
*   **The Pulpit 🚀**: A secure, real-time chat interface for communing with the agent.

> **Attribution**: This project is built upon the excellent [Dexter](https://github.com/virattt/dexter) framework by [Virat](https://twitter.com/virattt). We gratefully acknowledge their work as the foundation for Jubilee.

## The Triune Architecture

Jubilee operates through three distinct sub-agents that work in concert:

1.  **The Mind 🧠**: Analytical, logical, and data-driven. It has access to **read-only tools** (Search, Browser, Financial Metrics) to break down problems and find facts without risking system state.
2.  **The Prophet 👁️**: Intuitive, forward-looking, and strategic. It uses the same **read-only tools** to identify trends and "the bigger picture."
3.  **The Will ⚡**: The executor. It synthesizes insights and has **full tool access** (including OpenClaw and trading) to execute the final plan.

Every session begins and ends with a guiding verse, grounding the agent's operation in wisdom.

## Features

-   **Interactive Onboarding**: New "Steward" UI guides you through setting up your Admin Token and API keys seamlessly.
-   **OpenClaw Integration**: Can delegate system-level tasks to a local [OpenClaw](https://github.com/openclaw/openclaw) instance.
-   **Hosts Mode ("The Lord of Hosts")**: "The Will" can dispatch specialized sub-agents ("Angels") for parallel, isolated tasks (e.g., "Research Angel", "Coder Angel").
-   **Multi-Model Support**: Switch between GPT-4, Claude 3.5 Sonnet, Gemini Pro, and more on the fly.
-   **Self-Correction**: The agent reflects on its own output and iterates to improve warranty.

## ✅ Prerequisites

-   [Bun](https://bun.com) runtime (v1.0 or higher)
-   An API key for your preferred LLM provider (Google Gemini, OpenAI, Anthropic, etc.)
-   (Optional) Coinbase CDP API Key for Treasury features

## 🔑 Configuration

1.  **Environment Setup**: Copy `.env.example` to `.env`.
    ```bash
    cp .env.example .env
    ```
2.  **Setup Treasury Keys**:
    The Treasury module requires a Coinbase Developer Platform (CDP) API Key.
    Run the interactive setup script to configure your keys automatically (handles format conversion):
    ```bash
    bun scripts/setup_treasury.ts
    ```
    Follow the prompts to enter your API Name, Private Key, and Wallet Secret.

3.  **Required Variables**:
    -   `OPENAI_API_KEY`: For the brain (GPT-4o). (Feel free to use your preferred LLM provider. It could be Google Gemini, Anthropic, etc. OpenAI was simply used as an example.)

    **Optional Variables (for Onchain Treasury Use)**:
    
    -   `CDP_API_KEY_NAME`: From setup script.
    
    -   `CDP_API_KEY_PRIVATE_KEY`: From setup script.
    
    -   `CDP_WALLET_SECRET`: From setup script.
    
    -   `CDP_NETWORK_ID`: `base-mainnet` (for production) or `base-sepolia`.

## 💻 Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/jubilee-protocol/jubilee-agent.git
    cd jubilee-agent
    ```

2.  Install dependencies:
    ```bash
    bun install
    ```

## 🚀 Usage

### Option 1: The Full Experience (Web UI + Agent)
Run the entire OS (Frontend, Backend, Database) via Docker:
```bash
docker compose up --build
```
*   **The Steward (UI)**: [http://localhost:3000](http://localhost:3000)
*   **The Voice (API)**: [http://localhost:3001](http://localhost:3001)

### Option 2: Terminal Mode
Start the classic interactive CLI agent:
```bash
bun start
```
1.  **Select Provider**: Choose your AI provider (OpenAI, Anthropic, etc.).
2.  **Chat**: Enter your query (e.g., "Analyze the market").

## 🕊️ Hosts Mode ("The Lord of Hosts")

Jubilee can scale its attention by dispatching specialized sub-agents called **Angels**.
-   **Concept**: Uses the `dispatch_angel` tool to spawn a temporary, single-purpose agent.
-   **Capabilities**: Angels can be equipped with specific tools (e.g., "web_search", "skill") and a mission.
-   **Usage**: "The Will" automatically decides when to use this for complex, multi-step tasks.

## 🏫 The School of Prophets (Skills)
Jubilee is equipped with specialized workflows called **Skills** (e.g., `sermon-research`, `member-care`).

### How to Add New Skills
You can add new skills by creating a folder in `src/skills/` (e.g., `src/skills/my-new-skill/`) and adding a `SKILL.md` file.
**OpenClaw** is used for *executing* tools, not defining skills. Skills are defined via these markdown files.

**Example `SKILL.md` structure:**
```markdown
---
name: my-new-skill
description: A brief description of what this skill does.
---
# My New Skill
Instructions for the agent...
```
The agent automatically discovers new skills upon restart.

## 📜 The Chronicles (Memory)
Jubilee uses a privacy-first, local vector memory system (LanceDB) called "The Confessional".
-   **Active Recall**: The agent automatically searches memory for relevant context *before* answering user queries.
-   **Preference Learning**: The agent proactively learns your style (e.g., "User prefers KJV") and adapts.
-   **Safety**: All memories are guarded by **The Prophet**, preventing storage of heretical content or PII.

## 🌐 The Network (Integration)
Jubilee integrates with external tools while maintaining strict safety boundaries:
-   **Bible Tool**: Direct scripture lookup via `bible-api.com` (KJV, WEB, etc.).
-   **Communication**: "Draft-Only" email system. Jubilee writes drafts to a local folder for your review but **cannot send** messages directly.
-   **Anti-Spam**: Rate limits prevent bulk generation.
-   **Anti-Abuse**: Content filters block harmful language in drafts.

## 🛡️ The Prophet Guard

Every mission dispatched to an "Angel" (Sub-Agent) is first vetted by **The Prophet Guard**. This automated ethical safety check ensures:
-   **Adherence to the Nicene Creed**: Rejects heretical content (e.g., denying the Resurrection).
-   **Privacy Protection**: Blocks attempts to access or leak private member data.
-   **Truthfulness**: Prevents hallucination and deception.




## � The Confessional (Local Memory)

Jubilee features a privacy-first memory system stored locally:
-   **Storage**: [LanceDB](https://lancedb.com) (Vector Database)
-   **Privacy**: No data leaves your machine. Sensitive data (Member Care, Counseling notes) is safe.
-   **Usage**: The agent automatically "remembers" important facts and "recalls" them during conversation.

## 🦀 OpenClaw (System Capabilities)

Jubilee functions as a **System Agent** via the Model Context Protocol (MCP):
-   **Tools**: `shell_execute` (Run commands), `fs_read/write` (Manage files).
-   **Security**: Protected by **Double-Confirmation**. Sensitive commands require explicit user approval (e.g., "CONFIRM run this").
-   **Architecture**: Runs as a local MCP server (`src/mcp/servers/openclaw`).

## 🧠 The Deep Mind (Codebase Context)

Jubilee understands its own source code:
-   **Ingestion**: Indexes the `src/` directory into a local vector database.
-   **Search**: Use `search_codebase` to ask implementation questions (e.g., "How does the memory manager handle offline errors?").

## 💰 The Altar (Treasury) [Production Ready]

Jubilee includes a Treasury MCP server built on Coinbase AgentKit.
-   **Capabilities**:
    -   **Manage Assets**: Send/Receive ETH and ERC-20 tokens.
    -   **Invest/Swap**: Directly deposit USDC or cbBTC into Jubilee Vaults (jUSDi, jBTCi) using natural language (e.g., "Invest 500 USDC").
    -   **Onramp**: Buy crypto directly via Coinbase Pay button.
-   **Configuration**: Managed via "The Synod" or `.env`.

## 🏰 The Kingdom (Power Features)

Jubilee OS now includes advanced stewardship capabilities:

-   **The Altar (Treasury)**: Visual dashboard to view Vault TVL and user balances. Includes **Deposit/Withdraw** (Wagmi) and **Buy Crypto** (Coinbase Onramp).
-   **The Keys (Memory)**: Browse and **Delete** specific memories from "The Confessional" via the Archives page.
-   **The Reach (Socials)**: Toggle integrations for Twitter, Farcaster, YouTube, and Facebook via "The Synod".
-   **The Cloud (Deploy)**: Full support for one-click deployment to Railway or Docker. See `DEPLOYMENT.md`.

## 🛡️ Security Hardening

-   **Double-Confirmation**: Utilizing "The Will", sensitive actions (Shell, Transfers) are blocked unless the user explicitly types "CONFIRM", "APPROVE", or "YES".
-   **Resilience**: The Memory system degrades gracefully if local AI services (Ollama) are offline.

## �🤝 Contribution

We welcome contributions! Please fork the repo and submit a PR.

## 📄 License

This project is licensed under the MIT License.

---

> "Consecrate the fiftieth year and proclaim liberty throughout the land to all its inhabitants. It shall be a jubilee for you; each of you is to return to your family property and to your own clan." - Leviticus 25:10
