# Jubilee OS: Starship Verification Guide 🛠️

Follow these steps to test the full Jubilee OS (Terminal + UI) locally.

## ✅ Prerequisites
*   **Docker Desktop** (Running)
*   **Bun** (v1.0+)
*   **Wallet**: Coinbase Wallet or Metamask (for Treasury testing)

---

## 🔑 First Run: Onboarding

When you first access the apps (Pulpit, Synod, Archives), you will see the **Onboarding Screen**.
1.  **Enter your `Admin Token`**: This is defined in your `.env` as `JUBILEE_ADMIN_TOKEN`.
2.  If you don't have one set, check the terminal output from the backend—it prints the token on startup if it's auto-generated, or warns you if it's missing.

> **Note**: This token is saved to your browser's LocalStorage for convenience.

---

## 🚀 Mode 1: The Full Experience (Recommended)
Run everything (Database, Backend, Frontend) in containers. best for "Production-like" testing.

1.  **Start the System**:
    ```bash
    docker compose up --build
    ```
2.  **Access the UI**:
    *   Open **[http://localhost:3000](http://localhost:3000)**
    *   **The Pulpit**: Chat with the Agent.
    *   **The Altar**: Connect Wallet & Manage Treasury.
3.  **Access the Terminal**:
    *   The "Terminal Agent" is running inside the `jubilee-core` container. You can view its logs:
    ```bash
    docker compose logs -f jubilee-core
    ```

---

## 🛠️ Mode 2: Hybrid Dev (Frontend Focus)
Run the Backend in Docker, but run the Frontend locally for instant changes.

1.  **Start Backend & DB**:
    ```bash
    docker compose up -d postgres jubilee-core
    ```
2.  **Start Frontend**:
    ```bash
    cd web
    bun install
    bun run dev
    ```
3.  **Access**: Open **[http://localhost:3000](http://localhost:3000)**.

---

## 💻 Mode 3: Terminal Only (CLI Agent)
If you just want to talk to Jubilee in your terminal.

1.  **Ensure DB is running**:
    ```bash
    docker compose up -d postgres
    ```
2.  **Run Agent**:
    ```bash
    bun start
    ```
    *Select "Chat" to talk locally.*

---

## 🧪 Verification Checklist (Starship Features)

### 1. 🏰 The Altar (Treasury)
*   [ ] Navigate to **/altar**.
*   [ ] Click "Connect Wallet".
*   [ ] Verify **jUSDi** and **jBTCi** cards load (even if balances are 0).
*   [ ] **Test Onramp**: Click the **"Buy Crypto"** button.
    *   *Expected*: Opens Coinbase Pay in a new tab with your wallet address pre-filled.

### 2. 📡 The Synod (Socials)
*   [ ] Navigate to **/synod**.
*   [ ] Click **"Capabilities (Skills)"**.
*   [ ] **Test Toggles**: Find "YouTube" and "Facebook".
    *   *Action*: Click "Connect/Disconnect".
    *   *Expected*: Button state changes (Mock toggle).

### 3. 🧠 The Archives (Memory)
*   [ ] Navigate to **/archives**.
*   [ ] **Test Delete**: Hover over a memory card (if any exist) and click the Trash icon.
    *   *Expected*: Memory disappears from the list.

### 4. 🚀 The Pulpit (Chat)
*   [ ] Navigate to **/pulpit**.
*   [ ] Login with your `JUBILEE_ADMIN_TOKEN`.
*   [ ] **Test Chat**: Say "Hello Jubilee".
    *   *Expected*: Agent responds with "Thinking..." then an answer.

---

## 🧹 Cleanup
To stop everything and save battery:
```bash
docker compose down
```

## 🔧 Troubleshooting

### Docker "input/output error" or "failed to commit snapshot"
This is a common issue with Docker Desktop on Mac.
1.  **Restart Docker Desktop**: Click the whale icon -> specific -> Restart.
2.  **Prune System**: If restart fails, run this to clear corrupted cache:
    ```bash
    docker system prune -a
    ```
3.  **Try Again**: Run `docker compose up --build`.

### Port Conflicts (bind: address already in use)
If you see errors about ports 3000, 3001, or 5432:
1.  Stop all other terminal processes (Ctrl+C).
2.  Run `lsof -i :3000` to see what's using the port.
3.  Kill it with `kill -9 <PID>`.
