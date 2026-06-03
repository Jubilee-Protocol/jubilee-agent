# Jubilee OS: Triune Command Center (Web)

The visual interface for Jubilee OS, a "Triune Intelligence" system.

## 1. Quick Start

### Installation
Ensure you have `bun` or `npm` installed.

```bash
cd web
bun install
```

### Running Locally
To launch the Command Center in development mode:

```bash
bun dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production
To create an optimized production build:

```bash
bun run build
# The optimized output is in .next/
```

## 2. Features & Capabilities

The Dashboard is composed of three "Sovereign Panels," reflecting the Triune architecture. currently operating in **Mock Mode** (visualization only):

### 🧠 The Mind (Left Panel)
*   **Context Visualization**: Displays the size of indexed code context (e.g., "14.2 MB").
*   **Memory Health**: Shows the status of the LanceDB vector store (e.g., "Healthy", "1,024 Vectors").
*   *Function*: Currently static. Future integration will hook into the `jubilee-core` API to show real-time RAG stats.

### 👁️ The Prophet (Center Panel)
*   **Nicene Guard**: Displays the status of ethical filters ("Active").
*   **Guiding Verse**: A randomly selected or daily scripture verse setting the agent's "tone."
*   **Strategic Horizon**: Visual progress bar towards major milestones (e.g., "Pentecost 2026").
*   *Function*: Static visualization of the agent's ethical configuration.

### ⚡ The Will (Right Panel)
*   **The Altar (Treasury)**: Interactive display of treasury assets.
    *   **jUSDi / jBTCi**: Shows current yields and burn rates.
*   **Live Execution Log**: A scrolling feed of agent actions ("Harvesting yield", "Deploying contract").
*   *Function*:
    *   **Logs**: Currently simulated via `setInterval` in `WillPanel.tsx`. Real logs will stream via Server-Sent Events (SSE).
    *   **Treasury**: Visuals are hardcoded. Real data will come from `wagmi` reads (partially implemented in `/altar`).

## 3. Project Structure

- `src/components/dashboard/`: Contains the Triune panels (`MindPanel`, `ProphetPanel`, `WillPanel`).
- `src/components/dashboard/TriuneLayout.tsx`: The main layout wrapper with the Jubilee Crown header.
- `src/app/page.tsx`: The entry point rendering the dashboard.
