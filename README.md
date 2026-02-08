# Jubilee 🕊️

![Jubilee Logo](assets/jubilee_logo.png)

Jubilee is an autonomous AI agent built on a **Triune Architecture** (The Mind, The Prophet, The Will). It generalizes the agentic loop to handle financial research, coding tasks, and system operations while integrating biblical wisdom and [OpenClaw](https://openclaw.ai) capabilities.

> **Attribution**: This project is built upon the excellent [Dexter](https://github.com/virattt/dexter) framework by [Virat](https://twitter.com/virattt). We gratefully acknowledge their work as the foundation for Jubilee.

## The Triune Agent Architecture

Jubilee operates through three distinct sub-agents that work in concert:

1.  **The Mind 🧠**: Analytical, logical, and data-driven. It has access to **read-only tools** (Search, Browser, Financial Metrics) to break down problems and find facts without risking system state.
2.  **The Prophet 👁️**: Intuitive, forward-looking, and strategic. It uses the same **read-only tools** to identify trends and "the bigger picture."
3.  **The Will ⚡**: The executor. It synthesizes insights and has **full tool access** (including OpenClaw and trading) to execute the final plan.

Every session begins and ends with a guiding verse, grounding the agent's operation in wisdom.

## Features

-   **Interactive Setup**: Automatically detects your AI provider (OpenAI, Anthropic, Google, etc.) and prompts for API keys if missing.
-   **OpenClaw Integration**: Can delegate system-level tasks to a local [OpenClaw](https://github.com/openclaw/openclaw) instance.
-   **Hosts Mode ("The Lord of Hosts")**: "The Will" can dispatch specialized sub-agents ("Angels") for parallel, isolated tasks (e.g., "Research Angel", "Coder Angel").
-   **Multi-Model Support**: Switch between GPT-4, Claude 3.5 Sonnet, Gemini Pro, and more on the fly.
-   **Self-Correction**: The agent reflects on its own output and iterates to improve warranty.

## ✅ Prerequisites

-   [Bun](https://bun.com) runtime (v1.0 or higher)
-   An API key for your preferred LLM provider (Google Gemini, OpenAI, Anthropic, etc.)
-   (Optional) Coinbase CDP API Key for Treasury features

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

Start the interactive agent:

```bash
bun start
```

1.  **Select Provider**: Choose your AI provider from the list.
2.  **Select Model**: Pick the model you want to use.
3.  **Chat**: Enter your query (e.g., "Analyze the market", "Write a Python script", "Ask OpenClaw to check my logs").

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
-   **Architecture**: Runs as a local MCP server (`src/mcp/servers/openclaw`).
-   **Safety**: Currently runs with full user privileges. Future updates will include a sandbox mode.

## �🤝 Contribution

We welcome contributions! Please fork the repo and submit a PR.

## 📄 License

This project is licensed under the MIT License.

---

> "Consecrate the fiftieth year and proclaim liberty throughout the land to all its inhabitants. It shall be a jubilee for you; each of you is to return to your family property and to your own clan." - Leviticus 25:10
