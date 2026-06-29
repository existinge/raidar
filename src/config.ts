import * as fs from "fs";
import * as path from "path";
import { RadarConfig } from "./types.js";

const CONFIG_FILENAME = "radar.config.json";

export const DEFAULT_CONFIG: RadarConfig = {
  workspaceContext: {
    "mode": "external",
    "description": "rAIdar does not store personal project context by default. Agents may pass project context at runtime."
  } as any, // casting or matching schema
  signals: {
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
  sources: {
    "github": true,
    "hackernews": true,
    "x": true,
    "firecrawl": false,
    "manual": true
  },
  queryGroups: {
    "freeAccess": [
      "free API key AI",
      "free LLM API",
      "free model access",
      "free OpenRouter model",
      "no credit card AI API",
      "free tier LLM",
      "free AI credits",
      "free inference API"
    ],
    "localModels": [
      "new local LLM",
      "Ollama model",
      "LM Studio model",
      "small coding model",
      "open weights model",
      "consumer GPU LLM",
      "local coding model",
      "uncensored GGUF",
      "1M context local LLM",
      "reasoning GGUF model",
      "Qwen uncensored model"
    ],
    "agentWorkflow": [
      "MCP server",
      "coding agent tool",
      "browser agent",
      "computer use agent",
      "Firecrawl agent",
      "agent workflow",
      "AI coding workflow",
      "Claude Code skill",
      "Claude Code extension",
      "Cursor agent skill",
      "coding agent optimization"
    ],
    "repos": [
      "ai agent",
      "llm tool",
      "rag tool",
      "browser automation ai",
      "coding agent",
      "local llm tool"
    ]
  },
  "watchedUrls": [],
  "manualItems": [],
  "thresholds": {
    "deployNow": 8.5,
    "testSoon": 7,
    "bookmark": 5
  },
  "limits": {
    "githubPerKeyword": 5,
    "hackerNewsPerKeyword": 5,
    "maxItemsToJudge": 30
  },
  "llm": {
    "enabled": false,
    "provider": "openrouter",
    "model": "openai/gpt-4o-mini",
    "baseUrl": "",
    "apiKey": ""
  }
};

/**
 * Loads the radar configuration. If not present in the current working directory,
 * generates a default one.
 */
export function loadConfig(cwd: string = process.cwd()): RadarConfig {
  const configPath = path.join(cwd, CONFIG_FILENAME);
  
  if (!fs.existsSync(configPath)) {
    console.log(`Config file not found. Creating default generic ${CONFIG_FILENAME}...`);
    saveConfig(DEFAULT_CONFIG, cwd);
    return DEFAULT_CONFIG;
  }
  
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    
    // Merge loaded config with default config to ensure all fields exist
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      workspaceContext: { ...DEFAULT_CONFIG.workspaceContext, ...(parsed.workspaceContext || {}) },
      sources: { ...DEFAULT_CONFIG.sources, ...(parsed.sources || {}) },
      queryGroups: { ...DEFAULT_CONFIG.queryGroups, ...(parsed.queryGroups || {}) },
      thresholds: { ...DEFAULT_CONFIG.thresholds, ...(parsed.thresholds || {}) },
      limits: { ...DEFAULT_CONFIG.limits, ...(parsed.limits || {}) },
      llm: { ...DEFAULT_CONFIG.llm, ...(parsed.llm || {}) }
    };
  } catch (error: any) {
    console.warn(`Error loading config from ${configPath}, falling back to defaults. Error: ${error.message}`);
    return DEFAULT_CONFIG;
  }
}

/**
 * Saves config to the current directory
 */
export function saveConfig(config: RadarConfig, cwd: string = process.cwd()): void {
  const configPath = path.join(cwd, CONFIG_FILENAME);
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    console.log(`Saved configuration to ${configPath}`);
  } catch (error: any) {
    console.error(`Failed to save config to ${configPath}: ${error.message}`);
  }
}
