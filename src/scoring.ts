import { RadarConfig, SignalItem, AccessRoute } from "./types.js";
import { evaluateSignalWithLLM, extractAccessRoutesRuleBased } from "./llm.js";

/**
 * Calculates the access route score modifications based on rewards and penalties
 */
export function calculateAccessRouteScore(routes: AccessRoute[]): number {
  let score = 5.0; // Start with neutral base

  if (routes.length === 0) {
    score -= 1.0; // Penalty: access is unclear
    return score;
  }

  // Evaluate the best route
  const bestRoute = routes[0]; // Assume first is best or evaluate them collectively

  // Check if any route matches conditions
  const hasFreeOrTrial = routes.some(r => r.accessType === "free" || r.accessType === "free_trial" || r.accessType === "free_tier");
  const hasOpenAICompatible = routes.some(r => r.openAICompatible);
  const hasOpenRouter = routes.some(r => r.provider.toLowerCase().includes("openrouter"));
  const hasLocalOrOpenWeights = routes.some(r => r.accessType === "local" || r.accessType === "open_weights");
  const hasNoCreditCard = routes.some(r => !r.requiresCreditCard);
  const hasAgentUsable = routes.some(r => r.agentUsable);
  const hasEasySetup = routes.some(r => r.setupDifficulty === "easy");

  // Rewards (+8.0 possible)
  if (hasFreeOrTrial) score += 1.5;
  if (hasOpenAICompatible) score += 1.0;
  if (hasOpenRouter) score += 1.0;
  if (hasLocalOrOpenWeights) score += 1.0;
  if (hasEasySetup) score += 0.5; // clear setup docs / easy
  if (hasNoCreditCard) score += 1.0;
  if (hasAgentUsable) score += 1.0;
  // simple CLI/API integration (e.g. Ollama, OpenRouter, or official API)
  if (routes.some(r => ["ollama", "openrouter", "openai"].includes(r.provider.toLowerCase()) || r.provider.toLowerCase().includes("api"))) {
    score += 1.0;
  }

  // Penalties
  // 1. waitlist only
  const isWaitlistOnly = routes.every(r => r.notes?.toLowerCase().includes("waitlist") || false);
  if (isWaitlistOnly) score -= 2.0;

  // 2. enterprise only
  const isEnterpriseOnly = routes.every(r => r.notes?.toLowerCase().includes("enterprise") || r.accessType === "paid" && r.notes?.toLowerCase().includes("contact sales"));
  if (isEnterpriseOnly) score -= 2.0;

  // 3. pricing is hidden
  const isPricingHidden = routes.some(r => r.notes?.toLowerCase().includes("pricing is hidden") || r.notes?.toLowerCase().includes("hidden pricing"));
  if (isPricingHidden) score -= 1.0;

  // 4. no API/docs exist
  const noApiOrDocs = routes.every(r => r.notes?.toLowerCase().includes("no api") || r.notes?.toLowerCase().includes("no docs"));
  if (noApiOrDocs) score -= 2.0;

  // 5. model is too large for realistic local use
  const tooLarge = routes.some(r => r.accessType === "open_weights" && (r.notes?.toLowerCase().includes("impractical") || r.notes?.toLowerCase().includes("too large")));
  if (tooLarge) score -= 1.5;

  // 6. access requires unusual setup
  const unusualSetup = routes.some(r => r.setupDifficulty === "hard");
  if (unusualSetup) score -= 1.0;

  return Math.min(10.0, Math.max(0.0, score));
}

/**
 * Fallback generic fit scorer when LLM is disabled
 */
function calculateGenericWorkspaceFit(item: SignalItem): number {
  let fit = 5.0; // Start neutral
  const text = `${item.name} ${item.description} ${item.tags.join(" ")}`.toLowerCase();

  // MCP compatibility
  if (text.includes("mcp") || text.includes("model context protocol")) fit += 1.5;
  // CLI availability
  if (text.includes("cli") || text.includes("terminal") || text.includes("command line")) fit += 1.0;
  // Coding agent/Workflow
  if (text.includes("agent") || text.includes("workflow") || text.includes("automation")) fit += 1.5;
  // Local first / Open source
  if (text.includes("local") || text.includes("open source") || text.includes("open-source")) fit += 1.0;
  // Consumer hardware friendly
  if (text.includes("ollama") || text.includes("small model") || text.includes("quantized") || text.includes("gguf")) fit += 1.0;
  
  return Math.min(10.0, Math.max(0.0, fit));
}

/**
 * Fallback context fit scorer based on keyword matching
 */
function calculateContextWorkspaceFitHeuristic(item: SignalItem, context: string): { fit: number; summary: string } {
  const text = `${item.name} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
  const contextWords = context.toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3); // filter short words

  if (contextWords.length === 0) {
    return { fit: 5.0, summary: "Neutral generic workspace match." };
  }

  let matches = 0;
  for (const word of contextWords) {
    if (text.includes(word)) {
      matches++;
    }
  }

  // Calculate score based on number of matches
  const matchRatio = matches / Math.min(contextWords.length, 6);
  const fit = Math.min(10.0, Math.max(0.0, 5.0 + matchRatio * 5.0));
  
  // Create a short generic summary
  const summary = matches > 0 
    ? `Matches workspace concepts including ${contextWords.filter(w => text.includes(w)).slice(0, 3).join(", ")}.`
    : "Generic workspace fit based on workflow utility.";

  return { fit, summary };
}

/**
 * Evaluates and scores a candidate signal item
 */
export async function scoreSignal(
  item: SignalItem,
  config: RadarConfig,
  context?: string
): Promise<SignalItem> {
  let accessRoutes: AccessRoute[] = [];
  let bestAccessRoute: AccessRoute | undefined;
  let workspaceFit = 5.0;
  let contextUsed = false;
  let contextSummary: string | undefined;

  const hasContext = !!context && context.trim().length > 0;

  if (config.llm && config.llm.enabled) {
    // 1. LLM Scoring Mode
    const llmResult = await evaluateSignalWithLLM(item, config, context);
    accessRoutes = llmResult.accessRoutes;
    bestAccessRoute = llmResult.bestAccessRoute;
    workspaceFit = llmResult.workspaceFit;
    contextUsed = hasContext;
    contextSummary = llmResult.contextSummary;
  } else {
    // 2. Local Heuristic Scoring Mode
    const routesResult = extractAccessRoutesRuleBased(item);
    accessRoutes = routesResult.accessRoutes;
    bestAccessRoute = routesResult.bestAccessRoute;
    
    if (hasContext) {
      const contextResult = calculateContextWorkspaceFitHeuristic(item, context);
      workspaceFit = contextResult.fit;
      contextSummary = contextResult.summary;
      contextUsed = true;
    } else {
      workspaceFit = calculateGenericWorkspaceFit(item);
      contextSummary = "Strong generic fit for coding-agent fallback and low-cost experimentation.";
      contextUsed = false;
    }
  }

  // Calculate overall rating score
  const accessScore = calculateAccessRouteScore(accessRoutes);
  // Overall score is weighted: 40% Workspace Fit, 60% Access Route score (practically usable today)
  let score = workspaceFit * 0.4 + accessScore * 0.6;
  score = Math.round(score * 10) / 10; // Round to 1 decimal

  // Default explanations if LLM didn't provide them
  const whyItMatters = item.whyItMatters || 
    (item.description.length > 80 ? item.description.substring(0, 80) + "..." : item.description);

  let nextAction = item.nextAction;
  if (!nextAction) {
    if (bestAccessRoute?.provider.toLowerCase().includes("openrouter")) {
      nextAction = "Add the OpenRouter endpoint to your agent config and run one project-generation test.";
    } else if (bestAccessRoute?.provider.toLowerCase().includes("ollama")) {
      nextAction = "Run `ollama run <model>` to download and test the model interface locally.";
    } else {
      nextAction = "Review setup documentation and verify API key settings in your local environment.";
    }
  }

  let risk = item.risk;
  if (!risk) {
    if (bestAccessRoute?.accessType === "free" || bestAccessRoute?.accessType === "free_tier") {
      risk = "Free access may rate-limit heavily or change later.";
    } else if (bestAccessRoute?.accessType === "free_trial") {
      risk = "Requires monitoring credits before trial quota expires.";
    } else if (bestAccessRoute?.accessType === "open_weights") {
      risk = "Requires sufficient local GPU memory (VRAM) to run efficiently.";
    } else {
      risk = "Pricing model or rate limits are subject to change.";
    }
  }

  return {
    ...item,
    accessRoutes,
    bestAccessRoute,
    workspaceFit,
    score,
    contextUsed,
    contextSummary,
    whyItMatters,
    nextAction,
    risk
  };
}
