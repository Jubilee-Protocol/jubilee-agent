# Release Notes: Jubilee Agent v2026.2.7

## Major Architecture Upgrade

This release transforms Jubilee from a simple chatbot into a robust **Triune Agent System** capable of autonomous research, memory retention, and system operations.

### 1. Triune Architecture
-   **Structure**: Agent is now split into three roles: "The Mind" (Research), "The Prophet" (Strategy), and "The Will" (Execution).
-   **Specialized Toolsets**: `registry.ts` now enforces role-based tool access. "The Mind" cannot execute system commands; only "The Will" can.

### 2. The Confessional (Local Memory)
-   **Implementation**: Integrated **LanceDB** with Ollama embeddings.
-   **Capabilities**:
    -   `remember_fact`: Stores semantic memories (e.g., "Member Care: Betty - Hip Surgery").
    -   `recall_memories`: Semantic search over stored facts.
-   **Privacy**: All data is stored locally in `./lancedb`. No cloud vector store required.

### 3. OpenClaw System Interaction (MCP)
-   **Implementation**: Built a local **Model Context Protocol (MCP)** server (`src/mcp/servers/openclaw`).
-   **Capabilities**:
    -   `shell_execute`: Execute terminal commands.
    -   `fs_read`/`fs_write`: Full filesystem access.
-   **Security**:
    -   Implemented `allowedDirectories` whitelist in `mcp.json` to prevent path traversal.
    -   Basic command blacklist for potentially destructive operations.
-   **Client**: Added `McpManager` to dynamically load tools from `mcp.json`.

### 4. Church Skills
-   **Sermon Research**: Skill workflow for biblical analysis and illustration search.
-   **Member Care**: Workflow for tracking congregation needs and drafting pastoral responses.

## Technical Details
-   **Dependencies**: Added `@modelcontextprotocol/sdk`, `@lancedb/lancedb`, `uuid`.
-   **Configuration**: New `mcp.json` for server management.
-   **Scripts**: Added `full_audit.ts` for system verification.

## Security
-   **Warning**: The OpenClaw module provides shell access. It is currently un-sandboxed.
