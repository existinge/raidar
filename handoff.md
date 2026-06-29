# Agent Handoff - rAIdar CLI Access Scout

This document serves as a handoff file for new worker agents taking over development or maintenance of **rAIdar**.

rAIdar is a privacy-conscious, CLI-first developer workflow radar and access scout. It scans community feeds (GitHub, HackerNews, X/Twitter, manual logs) for new models, MCP servers, and developer tools, scoring them based on how easy, cheap, and local they are to access today.

---

## 📁 Repository Structure

*   `src/types.ts`: TypeScript interfaces for configurations (`RadarConfig`, `LlmConfig`) and signals (`SignalItem`, `AccessRoute`, `CommunityHype`).
*   `src/contracts.ts`: Implements programmatic data validation contracts to guarantee signal traceability.
*   `src/cli.ts`: Entrypoint containing Commander.js definitions for the `scan` and `recommend` commands. Preserves shebangs (`#!/usr/bin/env node`).
*   `src/config.ts`: Configuration loading and saving. Sanitized of local endpoints; defaults to disabled LLM.
*   `src/scanner.ts`: Scrapes GitHub Search API, HackerNews Algolia Search, manual config list, and X/Twitter (via DuckDuckGo site search).
*   `src/scoring.ts`: Scores candidate signals. Combines Workspace Fit (heuristic or LLM-guided context matching), Access Route capability (rewards local/free/OpenRouter; penalizes waitlists/enterprise barriers), and Community Hype.
*   `src/llm.ts`: Connects to OpenAI/OpenRouter APIs to extract structured routes, context fit summaries, and community hype sentiment.
*   `src/output.ts`: Formats reports into `radar-brief.md` (Markdown report) and `radar-feed.html` (interactive HTML RSS-style feed).
*   `.agents/skills/raidar/SKILL.md`: Workspace customization skill defining when and how agents can invoke rAIdar.

---

## 🛠️ Build and Development Commands

Before running or modifying code, ensure dependencies are installed:
```bash
npm install
```

### 1. Compile Code (TypeScript)
Compiles source files to the `dist/` folder:
```bash
npm run build
```

### 2. Run Scanner (Development)
Triggers a scan with custom workspace context, generating `radar-brief.md` and `radar-feed.html`:
```bash
npm run dev -- scan --context "your project context" --output "radar-brief.md" --html-output "radar-feed.html"
```

### 3. Run Recommendations (Development)
Outputs top recommendations directly to stdout:
```bash
npm run dev -- recommend --context "your project context"
```

### 4. Run Unit Tests (Vitest)
Executes scoring and validation contract tests:
```bash
npm run test
```

---

## 🛡️ Validation Contracts (`src/contracts.ts`)

Every item collected by rAIdar is run through the `validateSignalItem` contract checking that:
1.  `id`, `name`, and `description` are non-empty.
2.  `source` explicitly cites where it came from (e.g. "GitHub", "HackerNews", "X/Twitter").
3.  `url` is a valid HTTP/HTTPS address to guarantee direct, verified traceability of findings.

Any item failing this contract is filtered out in `scanner.ts` with a logged warning.

---

## 📈 Community Hype Scorer (`src/scoring.ts`)

Signals are analyzed for adoption velocity and excitement levels:
*   **HackerNews**: Extracts points/comments from the description to scale hype from niche to mainstream.
*   **GitHub**: Gauges star count descriptions and boosts scores for cutting-edge topics (like `mcp` or `uncensored`).
*   **X/Twitter**: Scans description text for hype indicators (like "insane", "game-changer", "next level") to assign sentiment and level.

---

## 🎨 HTML Feed Dashboard (`radar-feed.html`)

Calculated in `src/output.ts` as a self-contained, single-file HTML space designed for calm daily reporting:
*   **Theme Toggle**: Features a toggle button switching between a calm off-white light theme (`#f7f6f3` paper look) and the default void dark theme.
*   **Mascot Logo**: Embeds a custom vector inline SVG mascot of a smiling, blushing satellite radar dish robot.
*   **Compact Card Design**: Cards are side-by-side with padding minimized to `1.1rem` and title sizes at `1.15rem`.
*   **Structured Highlights**: Clean boxes for "Why it matters", "Workspace Fit", and "Scouted Access Routes".
*   **Image Attachments**: Displays thumbnails (e.g., `90x90px`). If no image is present, it dynamically draws an abstract, calm vector placeholder SVG with gradient styling.
*   **Interaction**: Handles live-filtering tabs, text search, and sorting (Score, Hype, Workspace Fit, Title) entirely client-side.
