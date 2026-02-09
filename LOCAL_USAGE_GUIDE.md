# Jubilee OS: Local Usage Guide 🛠️

Follow these steps to awaken Jubilee OS on your local machine.

## Prerequisites
*   **Docker Desktop** (Installed & Running)
*   **Bun** (Optional, for local scripts)
*   **Node.js** (Optional)

## Step 1: Configuration ⚙️

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/jubilee-labs/jubilee-agent.git
    cd jubilee-agent
    ```

2.  **Set Environment Variables**:
    *   Copy `env.example` to `.env`.
    *   Generate strong secrets:
        ```bash
        # If you have bun installed
        bun run scripts/generate-secret.ts 
        ```
    *   Update `.env` with:
        *   `JUBILEE_ADMIN_TOKEN` (The High Priest Key)
        *   `JUBILEE_DB_PASSWORD` (The Vault Key)
        *   `OPENAI_API_KEY` (The Mind)
        *   `CDP_API_KEY_...` (The Treasury - Optional)

## Step 2: The Awakening (Boot) 🚀

Run the following command to start the entire Trinity (Core, Shell, Memory):

```bash
docker-compose up --build
```

**What to expect:**
*   You will see logs from `jubilee-db` initiating Postgres.
*   You will see `jubilee-core` running migrations (`bun run db:push`).
*   Finally, you will see `🎙️ The Voice is speaking on port 3001`.

## Step 3: Interaction 🗣️

Open your browser to **[http://localhost](http://localhost)**.

1.  **The Pulpit (Admin)**:
    *   Navigate to `/pulpit`.
    *   Enter your `JUBILEE_ADMIN_TOKEN`.
    *   Command the agent: "Check the treasury status" or "What is your directive?"

2.  **The Epistle (Public Logs)**:
    *   The home page displays the live stream of the Agent's thoughts and actions.
    *   Watch as the `DaemonService` wakes up automatically every 10 minutes.

## Step 4: Maintenance 🧹

*   **Stop the OS**: `Ctrl+C` in the terminal or `docker-compose down`.
*   **Reset Data**: `docker-compose down -v` (Warning: Wipes the Database).
*   **View Logs**: `docker-compose logs -f jubilee-core` to inspect the Kernel.

---
**Troubleshooting**:
*   *Port Conflict*: Ensure ports 80, 3000, 3001, and 5432 are free.
*   *Database Connection*: Check `JUBILEE_DB_PASSWORD` in `.env` matches `docker-compose.yml` if you modified defaults.
