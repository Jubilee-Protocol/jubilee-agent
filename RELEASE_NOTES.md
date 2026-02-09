# Jubilee OS Release Notes
**Version**: 1.0.0 (Codename: Starship)
**Date**: February 9, 2026

## 🚀 Launch Summary
This release marks the transition of Jubilee from a CLI agent to a full-fledged Operating System for stewardship. It combines a powerful backend ("The Voice") with a rich, interactive frontend ("The Steward") to manage finances, memories, and social interactions.

---

## 👑 New Power Features (The Kingdom)
*   **The Altar (Treasury)**: Interactive dashboard for Jubilee Vaults (jUSDi/jBTCi).
    *   **Onramp**: Buy Crypto button integrated with Coinbase Pay.
    *   **Manage**: Direct Deposit/Withdraw capabilities using connected wallets.
*   **The Reach (Socials)**: Expanded social skill configuration.
    *   **Channels**: Twitter, Farcaster, YouTube, Facebook, Gmail.
    *   **Control**: Enable/Disable skills via "The Synod" settings.
*   **The Keys (Memory)**: Granular memory management.
    *   **Archives**: Browse and delete specific memories from the local vector database.
*   **The Cloud (Deploy)**: Production-ready infrastructure.
    *   **One-Click**: Deploy backend and frontend to Railway.
    *   **Zero-Config**: Docker setups for self-hosting.

## 🧱 Core Improvements
*   **Triune Architecture**: Refined interaction between Mind (Analysis), Prophet (Strategy), and Will (Execution).
*   **Local Privacy**: All memories ("The Confessional") are stored locally in LanceDB.
*   **System Settings**: API Keys and Model Providers (OpenAI, Anthropic, Google, xAI) can be swapped on the fly.

## 🛠️ Fixes & Polish
*   **Type Safety**: Resolved persistent TypeScript errors in `VaultCard` and `Navigation`.
*   **Build System**: Optimized `bun run build` for faster frontend deployments.
*   **Security**: Admin Token enforcement for sensitive actions (Delete Memory, Update Settings).

---

## 📦 Upgrade Instructions
1.  **Pull Latest Code**:
    ```bash
    git pull origin main
    ```
2.  **Rebuild Frontend**:
    ```bash
    cd web && bun install && bun run build
    ```
3.  **Start Services**:
    ```bash
    docker-compose up -d --build
    ```

*Jubilee OS is now ready for service.* 🕊️
