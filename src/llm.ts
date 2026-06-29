import axios from "axios";
import * as dotenv from "dotenv";
import { RadarConfig, SignalItem, AccessRoute, CommunityHype } from "./types.js";

dotenv.config();

/**
 * Normalizes access type keywords into the AccessRoute accessType enum.
 */
export function normalizeAccessType(type: string): AccessRoute["accessType"] {
  const t = type.toLowerCase().replace(/[^a-z_]/g, "");
  if (t === "free") return "free";
  if (t === "freetrial" || t === "free_trial") return "free_trial";
  if (t === "freetier" || t === "free_tier") return "free_tier";
  if (t === "paid") return "paid";
  if (t === "local") return "local";
  if (t === "openweights" || t === "open_weights") return "open_weights";
  return "unknown";
}

/**
 * Normalizes setup difficulty keywords into the AccessRoute setupDifficulty enum.
 */
export function normalizeDifficulty(diff: string): AccessRoute["setupDifficulty"] {
  const d = diff.toLowerCase().replace(/[^a-z]/g, "");
  if (d === "easy") return "easy";
  if (d === "medium") return "medium";
  if (d === "hard") return "hard";
  return "unknown";
}

/**
 * Fallback local/rule-based detector when LLM is offline or disabled.
 */
export function extractAccessRoutesRuleBased(item: SignalItem): {
  accessRoutes: AccessRoute[];
  bestAccessRoute: AccessRoute;
} {
  const text = `${item.name} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
  const routes: AccessRoute[] = [];

  // 1. Ollama (local)
  if (text.includes("ollama")) {
    routes.push({
      provider: "Ollama",
      url: "https://ollama.com",
      accessType: "local",
      setupDifficulty: "easy",
      requiresApiKey: false,
      requiresCreditCard: false,
      agentUsable: true,
      notes: "Local execution via Ollama CLI."
    });
  }

  // 2. OpenRouter
  if (text.includes("openrouter")) {
    routes.push({
      provider: "OpenRouter",
      url: "https://openrouter.ai",
      accessType: "free_tier",
      openAICompatible: true,
      setupDifficulty: "easy",
      requiresApiKey: true,
      requiresCreditCard: false,
      agentUsable: true,
      notes: "OpenAI-compatible API access with multiple models."
    });
  }

  // 3. Local / Open Weights (general)
  if (text.includes("local") || text.includes("open weight") || text.includes("open-weights") || text.includes("gguf")) {
    const tooLarge = text.includes("70b") || text.includes("405b") || text.includes("100b");
    routes.push({
      provider: "Local/GGUF",
      accessType: "open_weights",
      setupDifficulty: tooLarge ? "hard" : "medium",
      requiresApiKey: false,
      requiresCreditCard: false,
      agentUsable: !tooLarge,
      notes: tooLarge ? "Available, but likely impractical on consumer hardware." : "Run locally using llama.cpp or LM Studio."
    });
  }

  // 4. Official Provider / API
  const providers = ["openai", "anthropic", "gemini", "google", "meta", "cohere", "mistral", "deepseek", "qwen", "glm"];
  let matchedProvider = "Official API";
  for (const p of providers) {
    if (text.includes(p)) {
      matchedProvider = p.charAt(0).toUpperCase() + p.slice(1) + " API";
      break;
    }
  }

  const isFree = text.includes("free api") || text.includes("free tier") || text.includes("free credits");
  const isTrial = text.includes("free trial");
  
  routes.push({
    provider: matchedProvider,
    accessType: isFree ? "free_tier" : (isTrial ? "free_trial" : "paid"),
    requiresApiKey: true,
    requiresCreditCard: text.includes("credit card required") || text.includes("card required"),
    setupDifficulty: "easy",
    agentUsable: true,
    notes: `Official provider endpoint for ${item.name}.`
  });

  // Pick the best access route based on hierarchy: Free/Tier > Trial > Local > Paid
  let best = routes[0];
  const typePriority = (r: AccessRoute) => {
    switch (r.accessType) {
      case "free": return 4;
      case "free_tier": return 4;
      case "free_trial": return 3;
      case "local": return 2;
      case "open_weights": return 2;
      case "paid": return 1;
      default: return 0;
    }
  };

  for (const route of routes) {
    if (typePriority(route) > typePriority(best)) {
      best = route;
    }
  }

  return {
    accessRoutes: routes,
    bestAccessRoute: best || {
      provider: "Official API",
      accessType: "unknown",
      setupDifficulty: "unknown",
      notes: "Access routes details are not clearly visible."
    }
  };
}

/**
 * Uses LLM to evaluate the access route and context fit
 */
export async function evaluateSignalWithLLM(
  item: SignalItem,
  config: RadarConfig,
  context?: string
): Promise<{
  accessRoutes: AccessRoute[];
  bestAccessRoute: AccessRoute;
  workspaceFit: number;
  contextSummary?: string;
  communityHype?: CommunityHype;
}> {
  // If LLM is disabled, fall back immediately to rule-based
  if (!config.llm || !config.llm.enabled) {
    const { accessRoutes, bestAccessRoute } = extractAccessRoutesRuleBased(item);
    return {
      accessRoutes,
      bestAccessRoute,
      workspaceFit: 5.0, // default neutral fit
      contextSummary: context ? "Context evaluation skipped (LLM disabled)." : undefined
    };
  }

  const apiKey = config.llm.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("LLM is enabled but no API Key is set in config or environment. Falling back to rule-based evaluation.");
    const { accessRoutes, bestAccessRoute } = extractAccessRoutesRuleBased(item);
    return {
      accessRoutes,
      bestAccessRoute,
      workspaceFit: 5.0,
      contextSummary: context ? "Context evaluation skipped (Missing LLM API Key)." : undefined
    };
  }

  const provider = config.llm.provider || "openrouter";
  const model = config.llm.model || "openai/gpt-4o-mini";
  
  let baseUrl = config.llm.baseUrl;
  if (!baseUrl) {
    baseUrl = provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1";
  }

  const prompt = `
You are rAIdar's Access Scout AI. Analyze the following tool/model finding, extract access routes, and gauge its community hype & adoption score/sentiment. Keep notes/breakdowns very brief (<8 words).

Finding Name: ${item.name}
Finding Description: ${item.description}
Finding Tags: ${item.tags.join(", ")}
Source: ${item.source}
URL: ${item.url}

${context ? `We are running in the context of the following project/workspace:\n"${context}"` : ""}

Analyze and respond in JSON with EXACTLY the following format:
{
  "accessRoutes": [
    {
      "provider": "string (e.g. OpenRouter, Ollama, Anthropic API, etc.)",
      "url": "string (optional URL)",
      "accessType": "free" | "free_trial" | "free_tier" | "paid" | "local" | "open_weights" | "unknown",
      "openAICompatible": boolean,
      "requiresApiKey": boolean,
      "requiresCreditCard": boolean,
      "quota": "string (e.g. 100 req/day, 50k tokens, etc.)",
      "setupDifficulty": "easy" | "medium" | "hard" | "unknown",
      "agentUsable": boolean,
      "notes": "string (extremely brief, <8 words)"
    }
  ],
  "bestAccessRoute": {
     "provider": "...",
     "accessType": "...",
     "setupDifficulty": "...",
     "openAICompatible": boolean,
     "requiresApiKey": boolean,
     "requiresCreditCard": boolean,
     "agentUsable": boolean,
     "notes": "string (extremely brief, <8 words)"
  },
  "workspaceFit": number (0 to 10),
  "contextSummary": "string (extremely brief, <8 words)",
  "communityHype": {
     "score": number (0 to 10 scale of community adoption/hype),
     "level": "niche" | "growing" | "surging" | "mainstream",
     "sentiment": "skeptical" | "neutral" | "positive" | "highly_excited",
     "breakdown": "string (brief summary of tone/adoption, <8 words)"
  }
}
`;

  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/google-deepmind/antigravity",
          "X-Title": "rAIdar CLI"
        },
        timeout: 120000
      }
    );

    const jsonStr = response.data.choices[0].message.content;
    const result = JSON.parse(jsonStr);

    // Validate access routes structure
    if (result && Array.isArray(result.accessRoutes)) {
      return {
        accessRoutes: result.accessRoutes,
        bestAccessRoute: result.bestAccessRoute || result.accessRoutes[0],
        workspaceFit: typeof result.workspaceFit === "number" ? result.workspaceFit : 5.0,
        contextSummary: result.contextSummary,
        communityHype: result.communityHype
      };
    }
  } catch (error: any) {
    console.warn(`LLM Evaluation request failed: ${error.message}. Falling back to rule-based evaluation.`);
  }

  // Fallback if LLM fails
  const { accessRoutes, bestAccessRoute } = extractAccessRoutesRuleBased(item);
  return {
    accessRoutes,
    bestAccessRoute,
    workspaceFit: 5.0,
    contextSummary: context ? "Context evaluation skipped (LLM failed/timed out)." : undefined
  };
}
