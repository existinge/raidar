---
name: raidar
description: Scans for developer workflow signals, new LLM model releases, free APIs, local models, MCP servers, and tools using rAIdar.
---

# rAIdar — Access Scout CLI Skill

This skill allows agents to run **rAIdar**, a privacy-conscious developer workflow radar and access scout. Use rAIdar when you want to discover the latest developer enhancements, open-source tools, model updates, free API providers, or Model Context Protocol (MCP) servers.

## When to Use

1. **Scouting for new tools/models**: The user asks to see what's new in the AI development landscape.
2. **Checking for free or local access**: You need to find a free API key provider, a local model, or OpenRouter compatibility details for a task.
3. **Workspace alignment**: You want to check what workflow enhancements align best with your current project context.

## Usage Guide

To run rAIdar, make sure you are in the rAIdar project directory.

### 1. Generating a Signal Brief (Scan)

The `scan` command fetches findings from sources (like GitHub, HackerNews, or manual lists) and outputs an opinionated Markdown brief sorted by access score (e.g. "Deploy Now", "Test Soon", "Bookmark").

Run a generic scan:
```bash
npm run dev -- scan
```

Run a context-aware scan, which scores items based on a specific project focus (without saving the project details to disk):
```bash
npm run dev -- scan --context "local-first helpdesk automation app using TypeScript and AI agents"
```

You can also specify a custom output path for the brief:
```bash
npm run dev -- scan --output "my-radar-brief.md"
```

### 2. View Top Recommendations

The `recommend` command prints the top-scoring recommendations directly to stdout.

Run recommendations:
```bash
npm run dev -- recommend
```

With context:
```bash
npm run dev -- recommend --context "MCP server setup for Postgres databases"
```

## Reading the Signal Brief

The generated brief (default: `radar-brief.md`) sorts recommendations into three categories based on the **Access Scout Score** (1-10):

1. **🚀 Deploy Now (Score >= 8.5)**: Premium developer utility (free/free_tier, open weights, local models, or agent-usable tools). Low barrier to entry.
2. **⏳ Test Soon (Score >= 7.0)**: Useful tools or models, but might require a free trial or standard paid setup.
3. **📌 Bookmark (Score >= 5.0)**: Interesting updates, but might have barriers like waitlists, hidden pricing, or minimal documentation.
