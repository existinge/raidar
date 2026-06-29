# rAIdar — Access Scout CLI

rAIdar is a privacy-conscious, CLI-first AI workflow radar that scans for new developer workflow enhancements: repositories, model updates, free API providers, local model releases, MCP servers, and automation tools.

Instead of scanning just "what is trending," rAIdar acts as an **access scout**, prioritizing answering:
> **"Can I actually use this today, and what is the best route to do so?"**

---

## Key Features

1. **Access Route Detection**: For every model, tool, or API, rAIdar checks for local access, API compatibility (e.g. OpenAI), free tiers/trials, OpenRouter endpoints, and provider compatibility.
2. **Access Scout Scoring**: Items are rewarded for open weights, no-credit-card trials, OpenRouter availability, and agent usability. Items are heavily penalized for waitlists, hidden pricing, and enterprise-only walls.
3. **Workspace-Aware but Anonymous**: rAIdar does not hardcode or persist your personal names, projects, or interests in its config.
4. **Runtime Context**: External agents (like Antigravity, Claude Code, etc.) or you can pass workspace context dynamically during execution via arguments.

---

## Installation

```bash
# Clone or move to the project folder
cd scratch/raidar

# Install dependencies
npm install

# Build the project
npm run build
```

---

## CLI Usage

Run tasks dynamically with or without workspace-aware contexts.

### 1. Scan and Generate Brief
Scans active sources (GitHub, HackerNews, manual items) and outputs an opinionated Markdown brief sorting items into "Deploy Now", "Test Soon", and "Bookmark".

```bash
# Generic scanning (scores based on general AI dev utility)
npm run dev -- scan

# Dynamic project-specific context (context is NOT saved to disk)
npm run dev -- scan --context "local-first helpdesk automation app using TypeScript and AI agents"

# Context file scanning
npm run dev -- scan --context-file ./workspace-context.md
```

### 2. View Top Recommendations
Lists recommendation logs directly to the command line.

```bash
# Heuristic-based recommendation search
npm run dev -- recommend

# Context-guided recommendations
npm run dev -- recommend --context "MCP server setup for Postgres databases"
```

---

## Privacy-conscious Configuration

All configuration is stored in `radar.config.json`. The default configuration generated on the first run is fully generic and contains no private developer details:

```json
{
  "workspaceContext": {
    "mode": "external",
    "description": "rAIdar does not store personal project context by default. Agents may pass project context at runtime."
  },
  "signals": {
    "prioritize": [
      "free_api_access",
      "local_model_access",
      "open_source_tools",
      "mcp_servers",
      "coding_agent_tools",
      "browser_automation",
      "workflow_automation",
      "provider_updates",
      "cheap_inference",
      "consumer_hardware_friendly"
    ],
    "deprioritize": [
      "enterprise_only",
      "waitlist_only",
      "hype_only",
      "no_docs",
      "unclear_pricing",
      "research_only_no_release"
    ]
  },
  "sources": {
    "github": true,
    "hackernews": true,
    "firecrawl": false,
    "manual": true
  },
  "queryGroups": {
    "freeAccess": [
      "free API key AI",
      "free LLM API",
      "free model access"
    ],
    "localModels": [
      "new local LLM",
      "Ollama model"
    ]
  },
  "watchedUrls": [],
  "manualItems": [],
  "thresholds": {
    "deployNow": 8.5,
    "testSoon": 7.0,
    "bookmark": 5.0
  },
  "limits": {
    "githubPerKeyword": 5,
    "hackerNewsPerKeyword": 5,
    "maxItemsToJudge": 30
  },
  "llm": {
    "enabled": false,
    "provider": "openrouter",
    "model": "openai/gpt-4o-mini"
  }
}
```

- **Runtime context** passed via `--context` or `--context-file` is parsed in-memory at execution time to score items but is **never stored** in `radar.config.json`, keeping your project workspace completely private.
