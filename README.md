# Jubilee 🕊️

Jubilee is an autonomous AI agent built on a **Triune Architecture** (The Mind, The Prophet, The Will). It generalizes the agentic loop to handle financial research, coding tasks, and system operations while integrating biblical wisdom and [OpenClaw](https://openclaw.ai) capabilities.

> **Attribution**: This project is built upon the excellent [Dexter](https://github.com/virattt/dexter) framework by [Virat](https://twitter.com/virattt). We gratefully acknowledge their work as the foundation for Jubilee.

## The Triune Agent Architecture

Jubilee operates through three distinct sub-agents that work in concert:

1.  **The Mind 🧠**: Analytical, logical, and data-driven. It breaks down problems and seeks factual answers.
2.  **The Prophet 👁️**: Intuitive, forward-looking, and strategic. It looks for trends, implications, and "the bigger picture."
3.  **The Will ⚡**: The executor. It synthesizes the insights from The Mind and The Prophet into a concrete action plan and executes it.

Every session begins and ends with a guiding verse, grounding the agent's operation in wisdom.

## Features

-   **Interactive Setup**: Automatically detects your AI provider (OpenAI, Anthropic, Google, etc.) and prompts for API keys if missing.
-   **OpenClaw Integration**: Can delegate system-level tasks to a local [OpenClaw](https://github.com/openclaw/openclaw) instance.
-   **Multi-Model Support**: Switch between GPT-4, Claude 3.5 Sonnet, Gemini Pro, and more on the fly.
-   **Self-Correction**: The agent reflects on its own output and iterates to improve accuracy.

## ✅ Prerequisites

-   [Bun](https://bun.com) runtime (v1.0 or higher)
-   An API key for your preferred LLM provider (Google Gemini, OpenAI, Anthropic, etc.)

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

## 🤝 Contribution

We welcome contributions! Please fork the repo and submit a PR.

## 📄 License

This project is licensed under the MIT License.
