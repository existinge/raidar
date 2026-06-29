import { describe, it, expect } from "vitest";
import { calculateAccessRouteScore, scoreSignal } from "./scoring.js";
import { RadarConfig, SignalItem, AccessRoute } from "./types.js";

const DEFAULT_TEST_CONFIG: RadarConfig = {
  workspaceContext: { mode: "external" },
  sources: { github: true, hackernews: true, x: true, firecrawl: false, manual: true },
  queryGroups: { freeAccess: [], localModels: [], agentWorkflow: [], repos: [] },
  watchedUrls: [],
  manualItems: [],
  thresholds: { deployNow: 8.5, testSoon: 7.0, bookmark: 5.0 },
  limits: { githubPerKeyword: 5, hackerNewsPerKeyword: 5, maxItemsToJudge: 30 },
  llm: { enabled: false, provider: "openrouter", model: "openai/gpt-4o-mini" }
};

describe("Access Route Scoring Engine", () => {
  it("should penalize if there are no access routes (unclear access)", () => {
    const score = calculateAccessRouteScore([]);
    expect(score).toBe(4.0); // Base 5.0 - 1.0 = 4.0
  });

  it("should reward free access, openRouter, and OpenAI compatibility", () => {
    const routes: AccessRoute[] = [
      {
        provider: "OpenRouter",
        accessType: "free_tier",
        openAICompatible: true,
        setupDifficulty: "easy",
        requiresApiKey: true,
        requiresCreditCard: false,
        agentUsable: true
      }
    ];

    // Rewards applied:
    // Base: 5.0
    // free/trial (+1.5)
    // openAICompatible (+1.0)
    // openRouter (+1.0)
    // no credit card (+1.0)
    // agentUsable (+1.0)
    // easy setup (+0.5)
    // simple CLI/API (+1.0)
    // Expected access score: 10.0 (capped)
    const score = calculateAccessRouteScore(routes);
    expect(score).toBe(10.0);
  });

  it("should penalize waitlist and enterprise only options", () => {
    const routes: AccessRoute[] = [
      {
        provider: "Enterprise Portal",
        accessType: "paid",
        setupDifficulty: "medium",
        notes: "Waitlist only. Contact sales for enterprise pricing."
      }
    ];

    // Base: 5.0
    // waitlist only (-2.0)
    // enterprise only (-2.0)
    // simple CLI (+1.0)
    // Expected: 2.0
    const score = calculateAccessRouteScore(routes);
    expect(score).toBe(2.0);
  });

  it("should penalize local model if it is too large for realistic local use", () => {
    const routes: AccessRoute[] = [
      {
        provider: "Local Llama 405B",
        accessType: "open_weights",
        setupDifficulty: "hard",
        requiresApiKey: false,
        requiresCreditCard: false,
        notes: "GGUF model too large for consumer GPU setup. Impractical local use."
      }
    ];

    // Base: 5.0
    // local/open weight reward (+1.0)
    // no credit card (+1.0)
    // simple CLI (+1.0)
    // model too large penalty (-1.5)
    // hard setup difficulty penalty (-1.0)
    // Base: 5.0
    // local/open weight reward (+1.0) => 6.0
    // no credit card (+1.0) => 7.0
    // model too large penalty (-1.5) => 5.5
    // hard setup difficulty penalty (-1.0) => 4.5
    // Expected access score: 4.5
    const score = calculateAccessRouteScore(routes);
    expect(score).toBe(4.5);
  });
});

describe("Workspace Fit Scoring Heuristic", () => {
  it("should score generic fit high for MCP servers and automation tools", async () => {
    const item: SignalItem = {
      id: "test-mcp",
      name: "GitHub Files MCP Server",
      description: "An MCP server giving agents access to files on GitHub.",
      type: "MCP Server",
      source: "Manual",
      url: "https://github.com/mcp/github-files",
      tags: ["mcp", "agent", "workflow"],
      workspaceFit: 0,
      score: 0
    };

    const scored = await scoreSignal(item, DEFAULT_TEST_CONFIG);
    
    // Generic fit should reward MCP, agent, workflow
    expect(scored.workspaceFit).toBeGreaterThan(7.0);
    expect(scored.score).toBeGreaterThan(6.0);
  });

  it("should adjust fit when runtime context matches", async () => {
    const item: SignalItem = {
      id: "test-model",
      name: "Qwen2.5 Coding Model",
      description: "A fast TypeScript coding assistant model.",
      type: "Repository",
      source: "Manual",
      url: "https://github.com/qwen/qwen-coder",
      tags: ["qwen", "local", "coder"],
      workspaceFit: 0,
      score: 0
    };

    // Context focuses on TypeScript code helpers
    const context = "A TypeScript code automation framework";
    const scoredWithContext = await scoreSignal(item, DEFAULT_TEST_CONFIG, context);

    expect(scoredWithContext.contextUsed).toBe(true);
    expect(scoredWithContext.contextSummary?.toLowerCase()).toContain("typescript");
    expect(scoredWithContext.workspaceFit).toBeGreaterThan(5.0);
  });
});
