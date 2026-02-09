# Jubilee OS: Starship Verification Guide 🛠️

Follow these steps to test the full Jubilee OS (Terminal + UI) locally.

## ✅ Prerequisites
*   **Docker Desktop** (Running)
*   **Bun** (v1.0+)
*   **Wallet**: Coinbase Wallet or Metamask (for Treasury testing)

---

## 🚀 Mode 1: The Full Experience (Recommended)
Run everything (Database, Backend, Frontend) in containers. best for "Production-like" testing.

1.  **Start the System**:
    ```bash
    docker-compose up --build
    ```
2.  **Access the UI**:
    *   Open **[http://localhost:3000](http://localhost:3000)**
    *   **The Pulpit**: Chat with the Agent.
    *   **The Altar**: Connect Wallet & Manage Treasury.
3.  **Access the Terminal**:
    *   The "Terminal Agent" is running inside the `jubilee-core` container. You can view its logs:
    ```bash
    docker-compose logs -f jubilee-core
    ```

---

## 🛠️ Mode 2: Hybrid Dev (Frontend Focus)
Run the Backend in Docker, but run the Frontend locally for instant changes.

1.  **Start Backend & DB**:
    ```bash
    docker-compose up -d postgres jubilee-core
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
    docker-compose up -d postgres
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
docker-compose down
```
