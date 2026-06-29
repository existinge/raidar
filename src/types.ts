export type AccessRoute = {
  provider: string;
  url?: string;
  accessType:
    | "free"
    | "free_trial"
    | "free_tier"
    | "paid"
    | "local"
    | "open_weights"
    | "unknown";
  openAICompatible?: boolean;
  requiresApiKey?: boolean;
  requiresCreditCard?: boolean;
  quota?: string;
  setupDifficulty: "easy" | "medium" | "hard" | "unknown";
  agentUsable?: boolean;
  notes?: string;
};

export type SignalItem = {
  id: string;
  name: string;
  description: string;
  type: string; // e.g. "Free API Access", "Coding Model", "MCP Server", etc.
  source: string; // e.g. "GitHub", "HackerNews", "Manual"
  url: string;
  tags: string[];
  workspaceFit: number; // replaced personalFit
  score: number;
  accessRoutes?: AccessRoute[];
  bestAccessRoute?: AccessRoute;
  contextUsed?: boolean;
  contextSummary?: string;
  whyItMatters?: string;
  nextAction?: string;
  risk?: string;
};

export interface WorkspaceContext {
  mode: "external";
  description?: string;
}

export interface SourcesConfig {
  github: boolean;
  hackernews: boolean;
  x: boolean;
  firecrawl: boolean;
  manual: boolean;
}

export interface SignalsConfig {
  prioritize: string[];
  deprioritize: string[];
}

export interface QueryGroupsConfig {
  freeAccess: string[];
  localModels: string[];
  agentWorkflow: string[];
  repos: string[];
}

export interface ThresholdsConfig {
  deployNow: number;
  testSoon: number;
  bookmark: number;
}

export interface LimitsConfig {
  githubPerKeyword: number;
  hackerNewsPerKeyword: number;
  maxItemsToJudge: number;
}

export interface LlmConfig {
  enabled: boolean;
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface RadarConfig {
  workspaceContext: WorkspaceContext;
  signals?: SignalsConfig;
  sources: SourcesConfig;
  queryGroups: QueryGroupsConfig;
  watchedUrls: string[];
  manualItems: Omit<SignalItem, "score" | "workspaceFit">[];
  thresholds: ThresholdsConfig;
  limits: LimitsConfig;
  llm: LlmConfig;
}
