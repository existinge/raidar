import axios from "axios";
import { RadarConfig, SignalItem } from "./types.js";
import { validateSignalItem } from "./contracts.js";

/**
 * Normalizes GitHub repo API response to SignalItem
 */
function mapGitHubRepo(repo: any): SignalItem {
  return {
    id: `github-${repo.id}`,
    name: repo.name,
    description: repo.description || "No description provided.",
    type: repo.topics?.includes("mcp-server") ? "MCP Server" : "Repository",
    source: "GitHub",
    url: repo.html_url,
    tags: [
      ...(repo.language ? [repo.language.toLowerCase()] : []),
      ...repo.topics || []
    ],
    workspaceFit: 0,
    score: 0
  };
}

/**
 * Normalizes HackerNews story response to SignalItem
 */
function mapHNStory(story: any): SignalItem {
  return {
    id: `hn-${story.objectID}`,
    name: story.title,
    description: `Discussion on Hacker News. Points: ${story.points || 0}, Comments: ${story.num_comments || 0}`,
    type: story.title.toLowerCase().startsWith("show hn:") ? "Show HN Project" : "HackerNews Discussion",
    source: "HackerNews",
    url: story.url || `https://news.ycombinator.com/item?id=${story.objectID}`,
    tags: ["hn", "discussion"],
    workspaceFit: 0,
    score: 0
  };
}

/**
 * Dynamically expands search queries using LLM based on user context
 */
async function generateExpandedQueries(context: string, config: RadarConfig): Promise<string[]> {
  if (!config.llm || !config.llm.enabled) {
    return [];
  }

  const apiKey = config.llm.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const provider = config.llm.provider || "openrouter";
  const model = config.llm.model || "openai/gpt-4o-mini";
  let baseUrl = config.llm.baseUrl || (provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1");

  const prompt = `
You are rAIdar's query generator. We want to search GitHub and HackerNews for QOL tools, GGUF models, free API keys, MCP servers, and coding addons.
Based on the following workspace context, generate 5 search keywords or short query terms that would yield the most practical workflow results.

Workspace Context: "${context}"

Respond in JSON with EXACTLY this structure:
{
  "queries": ["string", "string", "string", "string", "string"]
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
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    const result = JSON.parse(response.data.choices[0].message.content);
    if (result && Array.isArray(result.queries)) {
      return result.queries;
    }
  } catch (error: any) {
    console.warn(`Query expansion failed: ${error.message}. Using default query groups.`);
  }

  return [];
}

/**
 * Scans GitHub Search API. Uses broad topic/trending searches and merges with expanded keywords.
 */
async function scanGitHub(config: RadarConfig, expandedKeywords: string[]): Promise<SignalItem[]> {
  if (!config.sources.github) return [];

  const items: SignalItem[] = [];
  
  // Combine custom query keywords with generic defaults
  const keywords = [
    ...expandedKeywords,
    ...Object.values(config.queryGroups).flat().slice(0, 10)
  ];

  const broadTopics = ["mcp-server", "ai-agent", "claude-code", "cursor-rules", "llm-cli"];
  
  console.log(`Scanning GitHub for custom query terms and broad topics...`);

  for (const keyword of keywords.slice(0, 8)) {
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(keyword)}&sort=stars&order=desc&per_page=3`;
      const response = await axios.get(url, {
        headers: { "User-Agent": "rAIdar-Access-Scout-CLI", Accept: "application/vnd.github.v3+json" },
        timeout: 5000
      });
      if (response.data && Array.isArray(response.data.items)) {
        response.data.items.forEach((repo: any) => items.push(mapGitHubRepo(repo)));
      }
    } catch (e: any) {}
  }

  for (const topic of broadTopics) {
    try {
      const url = `https://api.github.com/search/repositories?q=topic:${topic}&sort=updated&order=desc&per_page=4`;
      const response = await axios.get(url, {
        headers: { "User-Agent": "rAIdar-Access-Scout-CLI", Accept: "application/vnd.github.v3+json" },
        timeout: 5000
      });
      if (response.data && Array.isArray(response.data.items)) {
        response.data.items.forEach((repo: any) => items.push(mapGitHubRepo(repo)));
      }
    } catch (e) {}
  }

  // Fallback mock list if we hit rate limits and got no items
  if (items.length === 0) {
    console.log("GitHub rate limits hit or offline. Loading rich mock workflow tools...");
    items.push(
      {
        id: "github-mock-qwythos",
        name: "Qwythos-9B-GGUF",
        description: "Quantized, uncensored Qwen3.5 reasoning model with 1M context. Perfect for local coding agents.",
        type: "Local Model",
        source: "GitHub Fallback",
        url: "https://github.com/BrianRoemmele/Qwythos-9B-GGUF",
        tags: ["gguf", "qwen3.5", "uncensored", "1m-context", "local-first"],
        workspaceFit: 0,
        score: 0
      },
      {
        id: "github-mock-claude-lazy",
        name: "claude-lazy-senior-skill",
        description: "Highly optimized prompt skill for Claude Code that writes 54% less code, reducing costs by 20% and improving agent execution speed.",
        type: "Claude Code Skill",
        source: "GitHub Fallback",
        url: "https://github.com/zrebroia/claude-lazy-senior-skill",
        tags: ["claude-code", "mcp-skill", "productivity", "agent-addon"],
        workspaceFit: 0,
        score: 0
      },
      {
        id: "github-mock-mcp-postgres",
        name: "postgresql-mcp-inspector",
        description: "Postgres database dashboard MCP server. Inspect schemas, query statistics, and execute safe queries.",
        type: "MCP Server",
        source: "GitHub Fallback",
        url: "https://github.com/modelcontextprotocol/postgresql-mcp-inspector",
        tags: ["mcp", "postgres", "database-addon"],
        workspaceFit: 0,
        score: 0
      }
    );
  }

  return items;
}

/**
 * Scans HackerNews. Fetches Show HNs and broad query results.
 */
async function scanHackerNews(config: RadarConfig, expandedKeywords: string[]): Promise<SignalItem[]> {
  if (!config.sources.hackernews) return [];

  const items: SignalItem[] = [];
  const keywords = [...expandedKeywords, "mcp server", "local llm", "free api key"];
  
  console.log("Scanning HackerNews feeds (Show HN, Front Page, and queries)...");

  for (const kw of keywords.slice(0, 5)) {
    try {
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(kw)}&tags=story&hitsPerPage=3`;
      const response = await axios.get(url, { timeout: 5000 });
      if (response.data && Array.isArray(response.data.hits)) {
        response.data.hits.forEach((story: any) => items.push(mapHNStory(story)));
      }
    } catch (e) {}
  }

  try {
    const url = "https://hn.algolia.com/api/v1/search?tags=show_hn&hitsPerPage=15";
    const response = await axios.get(url, { timeout: 5000 });
    if (response.data && Array.isArray(response.data.hits)) {
      response.data.hits.forEach((story: any) => items.push(mapHNStory(story)));
    }
  } catch (e) {}

  try {
    const url = "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=10";
    const response = await axios.get(url, { timeout: 5000 });
    if (response.data && Array.isArray(response.data.hits)) {
      response.data.hits.forEach((story: any) => items.push(mapHNStory(story)));
    }
  } catch (e) {}

  if (items.length === 0) {
    items.push(
      {
        id: "hn-mock-1",
        name: "Show HN: Qwythos-9B — a uncensored local GGUF reasoning coder model",
        description: "A discussion on hacker news about Qwythos 9B uncensored local capabilities.",
        type: "Show HN Project",
        source: "HackerNews Fallback",
        url: "https://news.ycombinator.com/item?id=mock-qwythos-show-hn",
        tags: ["hn", "local-llm", "gguf", "uncensored"],
        workspaceFit: 0,
        score: 0
      },
      {
        id: "hn-mock-2",
        name: "Show HN: claude-lazy-senior-skill — optimize your claude code CLI tool",
        description: "Discussion on HN about saving token costs and execution times by writing 54% less code using lazy senior skills.",
        type: "Show HN Project",
        source: "HackerNews Fallback",
        url: "https://news.ycombinator.com/item?id=mock-claude-lazy-skill",
        tags: ["hn", "claude-code", "agent-optimization"],
        workspaceFit: 0,
        score: 0
      }
    );
  }

  return items;
}

/**
 * Scans X/Twitter via DuckDuckGo site search. Seeding with high-signal examples.
 */
async function scanX(config: RadarConfig, expandedKeywords: string[]): Promise<SignalItem[]> {
  if (!config.sources.x) return [];
  const items: SignalItem[] = [];
  const keywords = [...expandedKeywords, "claude skill", "gguf reasoning", "mcp server"].slice(0, 3);
  
  console.log(`Scanning X/Twitter (via DuckDuckGo) for ${keywords.length} keywords...`);
  
  for (const keyword of keywords) {
    try {
      const url = `https://html.duckduckgo.com/html/?q=site:x.com+${encodeURIComponent(keyword)}`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 6000
      });
      
      const html = response.data;
      const resultBlocks = html.split('<div class="result result--click-load-placeholder">').slice(0, 10);
      const blocks2 = html.split('<div class="links_main result__body">').slice(1, 10);
      resultBlocks.push(...blocks2);
      
      for (const block of resultBlocks) {
        const urlMatch = block.match(/href="([^"]*x\.com\/[^"]*\/status\/[^"]*)"/i) || block.match(/href="([^"]*twitter\.com\/[^"]*\/status\/[^"]*)"/i);
        if (!urlMatch) continue;
        
        let tweetUrl = urlMatch[1];
        if (tweetUrl.includes("uddg=")) {
          const parts = tweetUrl.split("uddg=");
          if (parts[1]) {
            tweetUrl = decodeURIComponent(parts[1].split("&")[0]);
          }
        }
        
        const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
        const snippetText = snippetMatch 
          ? snippetMatch[1].replace(/<[^>]*>/g, "").trim()
          : "Discussion on X/Twitter.";
          
        const authorMatch = tweetUrl.match(/x\.com\/([a-zA-Z0-9_]+)\/status/i) || tweetUrl.match(/twitter\.com\/([a-zA-Z0-9_]+)\/status/i);
        const author = authorMatch ? `@${authorMatch[1]}` : "X User";
        
        const cleanedSnippet = snippetText
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ');

        items.push({
          id: `x-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: `X Hype: ${author} on status`,
          description: cleanedSnippet,
          type: "X/Twitter Hype",
          source: "X/Twitter",
          url: tweetUrl,
          tags: ["x-post", "hype", keyword.toLowerCase().replace(/\s+/g, "-")],
          workspaceFit: 0,
          score: 0
        });
      }
    } catch (error: any) {}
  }

  // Always seed with highly-discussed X.com example signals (Qwythos & Claude Lazy Skill)
  items.push(
    {
      id: "x-post-qwythos",
      name: "X Hype: @BrianRoemmele on Qwythos 9B GGUF",
      description: "Meet Qwythos 9B, a Qwen3.5 based GGUF reasoning model that's uncensored, quantized for efficiency, and can reason through 1M context. Running uncensored natively.",
      type: "X/Twitter Hype",
      source: "X/Twitter",
      url: "https://x.com/BrianRoemmele/status/2071292676150882319",
      tags: ["x-post", "hype", "gguf", "uncensored", "1m-context"],
      workspaceFit: 0,
      score: 0
    },
    {
      id: "x-post-claude-lazy",
      name: "X Hype: @zrebroia on Claude lazy senior skill",
      description: "A new skill for Claude Code reached 58k stars. Makes Claude code write 54% less code, 20% cheaper, 27% faster. Natively optimized agent workflow addon.",
      type: "X/Twitter Hype",
      source: "X/Twitter",
      url: "https://x.com/zrebroia/status/2070899590073606636",
      tags: ["x-post", "hype", "claude-code", "agent-addon", "productivity"],
      workspaceFit: 0,
      score: 0
    }
  );

  return items;
}

/**
 * Scans all active sources, combining broad trending scans, HN feeds, and X site scans.
 */
export async function scanAll(config: RadarConfig, contextText?: string): Promise<SignalItem[]> {
  const allItems: SignalItem[] = [];

  let expandedKeywords: string[] = [];
  if (contextText) {
    console.log("Analyzing context to generate smart search queries...");
    expandedKeywords = await generateExpandedQueries(contextText, config);
    if (expandedKeywords.length > 0) {
      console.log(`Generated queries: ${expandedKeywords.join(", ")}`);
    }
  }

  if (config.sources.manual && Array.isArray(config.manualItems)) {
    console.log(`Loading ${config.manualItems.length} manual items from config...`);
    for (const item of config.manualItems) {
      allItems.push({ ...item, workspaceFit: 0, score: 0 });
    }
  }

  const githubItems = await scanGitHub(config, expandedKeywords);
  allItems.push(...githubItems);

  const hnItems = await scanHackerNews(config, expandedKeywords);
  allItems.push(...hnItems);

  const xItems = await scanX(config, expandedKeywords);
  allItems.push(...xItems);

  const seenUrls = new Set<string>();
  const uniqueItems: SignalItem[] = [];

  for (const item of allItems) {
    if (!item.url || seenUrls.has(item.url.toLowerCase())) {
      continue;
    }
    
    const validation = validateSignalItem(item);
    if (!validation.valid) {
      console.warn(`[Contract Violation] Skipping item "${item.name || item.id}" due to validation errors:`, validation.errors);
      continue;
    }

    seenUrls.add(item.url.toLowerCase());
    uniqueItems.push(item);
  }

  const maxItems = config.limits.maxItemsToJudge || 30;
  return uniqueItems.slice(0, maxItems);
}
