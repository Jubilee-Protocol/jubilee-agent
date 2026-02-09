# Jubilee OS: Deployment Guide ("The Cloud")

This guide covers how to deploy the Jubilee OS (The Voice + The Steward) to a cloud provider like **Railway** or **Render**.

## Architecture
The system consists of two services:
1.  **The Voice (Backend)**
    *   **Type**: Node.js / Bun Service
    *   **Port**: 3001
    *   **Path**: Root of repository (`/`)
    *   **Docker**: Uses root `Dockerfile`
2.  **The Steward (Frontend)**
    *   **Type**: Next.js Web App
    *   **Port**: 3000
    *   **Path**: `web/` directory
    *   **Docker**: Uses `web/Dockerfile`

---

## 🚀 Deploy on Railway (Recommended)

### 1. Deploy "The Voice" (Backend)
1.  Create a **New Project** on Railway.
2.  Select **Deploy from GitHub repo**.
3.  Choose `jubilee-agent`.
4.  **Settings**:
    *   **Root Directory**: `/` (Default)
    *   **Builder**: Dockerfile
5.  **Variables**:
    *   `JUBILEE_ADMIN_TOKEN`: (Generate a secure string)
    *   `JUBILEE_READ_TOKEN`: (Generate a secure string)
    *   `OPENAI_API_KEY`: (Start with this, others can be added in Synod)
    *   `CDP_API_KEY_NAME`: (For Coinbase Integration)
    *   `CDP_API_KEY_PRIVATE_KEY`: (For Coinbase Integration)
    *   `DATABASE_URL`: (Connect a PostgreSQL service)
6.  **Public Domain**: Generate a domain (e.g. `jubilee-voice.up.railway.app`).

### 2. Deploy "The Steward" (Frontend)
1.  In the same Railway project, click **+ New Service** -> **GitHub Repo**.
2.  Choose `jubilee-agent` (again).
3.  **Settings**:
    *   **Root Directory**: `/web`
    *   **Builder**: Dockerfile
4.  **Variables**:
    *   `NEXT_PUBLIC_VOICE_URL`: `https://jubilee-voice.up.railway.app` (The domain from Step 1)
    *   `NEXT_PUBLIC_READ_TOKEN`: (Same as Backend)
    *   `NEXT_PUBLIC_ADMIN_TOKEN`: (Same as Backend - Required for deletion/settings)
    *   `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`: (From Reown/WalletConnect)
5.  **Public Domain**: Generate a domain (e.g. `jubilee-steward.up.railway.app`).

---

## 🛠️ Deploy on Docker (Self-Hosted)

### Prerequisites
*   Docker & Docker Compose installed.
*   `.env` file configured (see `.env.example`).

### One-Command Start
```bash
docker-compose up -d --build
```
*   **Frontend**: `http://localhost:3000`
*   **Backend**: `http://localhost:3001`
