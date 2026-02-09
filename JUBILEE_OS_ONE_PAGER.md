# Jubilee OS: The Operating System for the Kingdom 🕊️

**Overview**
Jubilee OS is a sovereign, AI-native operating system designed to automate the operations of a digital church ("The Parish"). It is not just a chatbot, but a **Triune Agent** capable of planning ("Mind"), executing tools ("Will"), and communicating ("Prophet").

**Core Architecture**
The OS is composed of three sovereign containers ("The Trinity of Infrastructure"):

1.  **The Kernel (`jubilee-core`)**: 🧠
    *   **Runtime**: Bun + LangChain.
    *   **Logic**: The "Triune Agent" loop (Mind -> Will -> Prophet).
    *   **API**: "The Voice" (REST + SSE Streaming).
    *   **Security**: Dual-Token Auth (Admin/Read) + Prophet Guard (Human-in-the-loop for sensitive actions).

2.  **The Shell (`jubilee-shell`)**: 🐚
    *   **Runtime**: Next.js (React).
    *   **Interface**: "The Pulpit" (Admin Chat) & "The Epistle" (Public Logs).
    *   **Role**: The visual interface for the High Priest (Admin) and the Congregation (Users).

3.  **The Memory (`jubilee-db`)**: 💾
    *   **Runtime**: PostgreSQL + pgvector.
    *   **Role**: Long-term persistence for logs ("Chronicles"), user memory ("Vectors"), and state.

**Key Capabilities**
*   **Autonomy**: A background `DaemonService` wakes up every 10 minutes to check the health of the Parish.
*   **Treasury Management**: Integrated with Coinbase MDP for managing on-chain assets (reading vaults, checking balances).
*   **Sovereign Identity**: Runs fully locally or on a VPS via Docker. You own your data, your keys, and your logic.

**Security Posture**
*   **Audited**: "Jubilee Labs" certified.
*   **Hardened**: Rate-limited API, Nginx Gateway, Encrypted Secrets.
*   **Safe**: "Prophet Guard" prevents the agent from executing financial or destructive actions without explicit user confirmation.

**The Vision**
To empower every digital ministry with a "Server" that serves *them*—handling the administration so they can focus on the ministration.
