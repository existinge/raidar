import { SignalItem, AccessRoute, RadarConfig } from "./types.js";

/**
 * Formats a single AccessRoute to a friendly readable string
 */
function formatRoute(r: AccessRoute): string {
  const parts: string[] = [];
  parts.push(r.accessType.replace("_", " "));
  if (r.openAICompatible) parts.push("OpenAI-compatible");
  if (r.requiresApiKey) parts.push("API key required");
  else if (r.requiresApiKey === false) parts.push("no API key");
  if (r.requiresCreditCard) parts.push("credit card required");
  else if (r.requiresCreditCard === false) parts.push("no credit card");
  parts.push(`${r.setupDifficulty} setup`);
  if (r.quota) parts.push(`quota: ${r.quota}`);

  const details = parts.join(", ");
  return `${r.provider} — ${details}${r.notes ? ` (${r.notes})` : ""}`;
}

/**
 * Builds the access routes block for an item
 */
function buildAccessRoutesBlock(item: SignalItem): string {
  const routes = item.accessRoutes || [];
  if (routes.length === 0) {
    return "Access routes:\n- Unclear access routes or pricing information.";
  }

  const best = item.bestAccessRoute 
    ? `- Best route: ${formatRoute(item.bestAccessRoute)}` 
    : `- Best route: ${formatRoute(routes[0])}`;

  const alternates = routes.filter(r => r !== item.bestAccessRoute && r.accessType !== "local" && r.accessType !== "open_weights");
  const localRoutes = routes.filter(r => r.accessType === "local" || r.accessType === "open_weights");

  let out = `Access routes:\n${best}`;

  if (alternates.length > 0) {
    out += `\n- Alternate: ${formatRoute(alternates[0])}`;
  }

  if (localRoutes.length > 0) {
    out += `\n- Local: ${formatRoute(localRoutes[0])}`;
  } else {
    out += `\n- Local: Available but likely impractical on consumer hardware (No local configuration details provided)`;
  }

  return out;
}

/**
 * Generates the Signal Brief in Markdown format
 */
export function generateMarkdownBrief(
  items: SignalItem[],
  config: RadarConfig,
  contextText?: string
): string {
  const dateStr = new Date().toISOString().split("T")[0];
  
  let md = `# rAIdar Signal Brief — ${dateStr}\n\n`;
  md += `rAIdar is a privacy-conscious access scout for AI workflows.\n\n`;

  if (contextText) {
    md += `> [!NOTE]\n`;
    md += `> **Active Workspace Context**: "${contextText.trim()}"\n`;
    md += `> Relevance scores have been adjusted for this project context.\n\n`;
  }

  // Sort items by score descending
  const sorted = [...items].sort((a, b) => b.score - a.score);

  const deployThreshold = config.thresholds.deployNow || 8.5;
  const testThreshold = config.thresholds.testSoon || 7.0;
  const bookmarkThreshold = config.thresholds.bookmark || 5.0;

  const deployNow = sorted.filter(i => i.score >= deployThreshold);
  const testSoon = sorted.filter(i => i.score >= testThreshold && i.score < deployThreshold);
  const bookmark = sorted.filter(i => i.score >= bookmarkThreshold && i.score < testThreshold);
  const ignore = sorted.filter(i => i.score < bookmarkThreshold);

  const renderItem = (item: SignalItem, index: number) => {
    let itemMd = `### ${index}. ${item.name}\n\n`;
    itemMd += `Type: ${item.type}  \n`;
    itemMd += `Access: ${item.bestAccessRoute?.accessType.replace("_", " ") || "unknown"}  \n`;
    itemMd += `Score: ${item.score}/10  \n`;
    itemMd += `Source: ${item.source} (${item.url})  \n\n`;
    
    itemMd += `Why it matters: ${item.whyItMatters || item.description}  \n`;
    
    if (item.contextUsed && item.contextSummary) {
      itemMd += `Workspace fit: ${item.contextSummary}  \n`;
    } else {
      itemMd += `Workspace fit: Strong generic fit for coding-agent fallback and low-cost experimentation.  \n`;
    }

    itemMd += `Next action: ${item.nextAction}  \n`;
    itemMd += `Risk: ${item.risk}  \n\n`;

    itemMd += `\`\`\`md\n`;
    itemMd += `${buildAccessRoutesBlock(item)}\n\n`;
    itemMd += `Best next step: ${item.nextAction}\n`;
    itemMd += `\`\`\`\n\n`;

    return itemMd;
  };

  md += `## 🚀 Deploy Now (Score >= ${deployThreshold})\n\n`;
  if (deployNow.length === 0) md += "_No items currently meet the Deploy Now threshold._\n\n";
  else deployNow.forEach((item, i) => { md += renderItem(item, i + 1); });

  md += `## 🔬 Test Soon (Score ${testThreshold} - ${deployThreshold - 0.1})\n\n`;
  if (testSoon.length === 0) md += "_No items currently meet the Test Soon threshold._\n\n";
  else testSoon.forEach((item, i) => { md += renderItem(item, i + 1); });

  md += `## 🔖 Bookmark (Score ${bookmarkThreshold} - ${testThreshold - 0.1})\n\n`;
  if (bookmark.length === 0) md += "_No items currently bookmarked._\n\n";
  else bookmark.forEach((item, i) => { md += renderItem(item, i + 1); });

  if (ignore.length > 0) {
    md += `## 💤 Deprioritized / Ignore (Score < ${bookmarkThreshold})\n\n`;
    ignore.forEach(item => {
      md += `- **${item.name}** (Score: ${item.score}/10) — Access is too complex, enterprise-only, or waitlisted.\n`;
    });
    md += "\n";
  }

  return md;
}

/**
 * Generates the Signal Brief in HTML Feed format (RSS-dashboard style)
 */
export function generateHtmlFeed(
  items: SignalItem[],
  config: RadarConfig,
  contextText?: string
): string {
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const deployThreshold = config.thresholds.deployNow || 8.5;
  const testThreshold = config.thresholds.testSoon || 7.0;
  const bookmarkThreshold = config.thresholds.bookmark || 5.0;

  const deployNowCount = items.filter(i => i.score >= deployThreshold).length;
  const testSoonCount = items.filter(i => i.score >= testThreshold && i.score < deployThreshold).length;
  const bookmarkCount = items.filter(i => i.score >= bookmarkThreshold && i.score < testThreshold).length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>rAIdar - Access Scout Feed</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0b0f19;
      --panel-bg: rgba(22, 28, 45, 0.4);
      --panel-border: rgba(255, 255, 255, 0.08);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --accent-primary: #8b5cf6;
      --accent-primary-glow: rgba(139, 92, 246, 0.2);
      --accent-secondary: #06b6d4;
      --accent-success: #10b981;
      --accent-success-glow: rgba(16, 185, 129, 0.25);
      --accent-warning: #f59e0b;
      --accent-warning-glow: rgba(245, 158, 11, 0.2);
      --accent-danger: #ef4444;
      --shadow-color: rgba(0, 0, 0, 0.4);
      --card-hover-border: rgba(139, 92, 246, 0.4);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-color);
      color: var(--text-main);
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      padding: 2rem 1.5rem;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.05) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.05) 0%, transparent 40%);
      background-attachment: fixed;
    }

    header {
      max-width: 1200px;
      margin: 0 auto 2.5rem auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 1.5rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .radar-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      box-shadow: 0 0 15px var(--accent-primary-glow);
    }

    .radar-pulse {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 1px solid var(--accent-primary);
      animation: pulse 2s infinite ease-out;
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    .brand-text h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(to right, #ffffff, #a5b4fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-text p {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.1rem;
    }

    .scan-date {
      text-align: right;
    }

    .scan-date span {
      display: block;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .scan-date strong {
      font-family: 'Outfit', sans-serif;
      font-size: 1rem;
      color: var(--text-main);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Context Banner */
    .context-banner {
      background: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }

    .context-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      font-size: 0.95rem;
      color: #a5b4fc;
    }

    .context-header span {
      background: var(--accent-primary);
      color: white;
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .context-body {
      font-size: 0.95rem;
      line-height: 1.5;
      color: #cbd5e1;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }

    .stat-card {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      backdrop-filter: blur(12px);
      box-shadow: 0 4px 15px var(--shadow-color);
    }

    .stat-card.deploy { border-left: 4px solid var(--accent-success); }
    .stat-card.test { border-left: 4px solid var(--accent-secondary); }
    .stat-card.bookmark { border-left: 4px solid var(--accent-warning); }

    .stat-info span {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .stat-info h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.75rem;
      font-weight: 700;
      margin-top: 0.25rem;
    }

    .stat-icon {
      font-size: 1.5rem;
      opacity: 0.8;
    }

    /* Controls */
    .controls {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 1rem 1.5rem;
      margin-bottom: 2rem;
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      align-items: center;
      justify-content: space-between;
      backdrop-filter: blur(12px);
    }

    .search-box {
      position: relative;
      flex-grow: 1;
      min-width: 250px;
    }

    .search-box input {
      width: 100%;
      padding: 0.6rem 1rem 0.6rem 2.5rem;
      border-radius: 8px;
      border: 1px solid var(--panel-border);
      background: rgba(15, 23, 42, 0.6);
      color: var(--text-main);
      font-size: 0.9rem;
      outline: none;
      transition: all 0.3s;
    }

    .search-box input:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 10px rgba(139, 92, 246, 0.15);
    }

    .search-box::before {
      content: "🔍";
      position: absolute;
      left: 0.85rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.85rem;
      opacity: 0.5;
    }

    .filters {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .filter-tab {
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid var(--panel-border);
      color: var(--text-muted);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.3s;
    }

    .filter-tab:hover {
      background: rgba(30, 41, 59, 0.8);
      color: var(--text-main);
    }

    .filter-tab.active {
      background: var(--accent-primary);
      color: white;
      border-color: var(--accent-primary);
      box-shadow: 0 0 12px var(--accent-primary-glow);
    }

    .sorter {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .sorter select {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--panel-border);
      color: var(--text-main);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      outline: none;
      cursor: pointer;
    }

    /* Feed Grid */
    .feed-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    /* Card Styling */
    .feed-card {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      padding: 1.5rem;
      backdrop-filter: blur(12px);
      box-shadow: 0 4px 20px var(--shadow-color);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
    }

    .feed-card:hover {
      transform: translateY(-4px);
      border-color: var(--card-hover-border);
      box-shadow: 0 8px 30px rgba(139, 92, 246, 0.1);
    }

    .card-glow {
      position: absolute;
      top: -150px;
      right: -150px;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--accent-primary-glow) 0%, transparent 70%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.5s;
    }

    .feed-card:hover .card-glow {
      opacity: 1;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
      gap: 1rem;
    }

    .card-meta {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .source-tag {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent-secondary);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .source-tag a {
      color: inherit;
      text-decoration: underline;
    }

    .source-tag a:hover {
      color: var(--text-main);
    }

    .card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text-main);
    }

    /* Score gauge */
    .score-badge-container {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .score-badge {
      width: 3.2rem;
      height: 3.2rem;
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Outfit', sans-serif;
      font-size: 1.15rem;
      font-weight: 800;
      border: 3px solid #ccc;
      box-shadow: 0 0 10px rgba(0,0,0,0.3);
    }

    .score-badge.deploy {
      border-color: var(--accent-success);
      color: var(--accent-success);
      box-shadow: 0 0 12px var(--accent-success-glow);
    }

    .score-badge.test {
      border-color: var(--accent-secondary);
      color: var(--accent-secondary);
    }

    .score-badge.bookmark {
      border-color: var(--accent-warning);
      color: var(--accent-warning);
    }

    .score-badge.deprioritized {
      border-color: var(--text-muted);
      color: var(--text-muted);
    }

    .score-label {
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-top: 0.25rem;
      font-weight: 600;
      letter-spacing: 0.05em;
    }

    /* Description and pills */
    .tags {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .tag-pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
    }

    .card-description {
      font-size: 0.95rem;
      line-height: 1.6;
      color: #cbd5e1;
      margin-bottom: 1.25rem;
    }

    /* Structured Highlights */
    .highlight-section {
      background: rgba(15, 23, 42, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.03);
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 1.25rem;
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    @media (min-width: 768px) {
      .highlight-section {
        grid-template-columns: 1fr 1fr;
        gap: 1.25rem;
      }
    }

    .highlight-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .highlight-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent-primary);
    }

    .highlight-body {
      font-size: 0.85rem;
      line-height: 1.5;
      color: var(--text-main);
    }

    /* Access routes detail */
    .routes-detail {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 1.25rem;
    }

    .routes-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent-secondary);
      margin-bottom: 0.5rem;
    }

    .route-row {
      display: flex;
      justify-content: space-between;
      padding: 0.4rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.03);
      font-size: 0.85rem;
    }

    .route-row:last-child {
      border-bottom: none;
    }

    .route-name {
      font-weight: 500;
      color: var(--text-main);
    }

    .route-details {
      color: #cbd5e1;
      text-align: right;
    }

    /* Action block */
    .action-block {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: space-between;
      align-items: center;
      padding-top: 1rem;
      border-top: 1px solid var(--panel-border);
    }

    .next-step {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: #fff;
    }

    .next-step span {
      background: var(--accent-success);
      color: black;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .risk-info {
      font-size: 0.8rem;
      color: #fca5a5;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .no-results {
      text-align: center;
      padding: 4rem 2rem;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      color: var(--text-muted);
      font-size: 1.1rem;
    }

    footer.feed-footer {
      max-width: 1200px;
      margin: 4rem auto 0 auto;
      text-align: center;
      padding-top: 1.5rem;
      border-top: 1px solid var(--panel-border);
      color: var(--text-muted);
      font-size: 0.8rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="radar-icon">
          <div class="radar-pulse"></div>
          📡
        </div>
        <div class="brand-text">
          <h1>rAIdar Access Scout Feed</h1>
          <p>Privacy-conscious AI workflow updates and local access options</p>
        </div>
      </div>
      <div class="scan-date">
        <span>Scan Completed</span>
        <strong>${dateStr}</strong>
      </div>
    </header>

    ${
      contextText
        ? `
    <div class="context-banner">
      <div class="context-header">
        <span>Active Focus</span>
        Workspace Search Context
      </div>
      <div class="context-body">
        "${contextText.trim()}"
      </div>
    </div>
    `
        : ""
    }

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-info">
          <span>Total Findings</span>
          <h2>${items.length}</h2>
        </div>
        <div class="stat-icon">🔍</div>
      </div>
      <div class="stat-card deploy">
        <div class="stat-info">
          <span>Deploy Now</span>
          <h2>${deployNowCount}</h2>
        </div>
        <div class="stat-icon">🚀</div>
      </div>
      <div class="stat-card test">
        <div class="stat-info">
          <span>Test Soon</span>
          <h2>${testSoonCount}</h2>
        </div>
        <div class="stat-icon">🔬</div>
      </div>
      <div class="stat-card bookmark">
        <div class="stat-info">
          <span>Bookmark</span>
          <h2>${bookmarkCount}</h2>
        </div>
        <div class="stat-icon">🔖</div>
      </div>
    </div>

    <div class="controls">
      <div class="search-box">
        <input type="text" id="search-input" placeholder="Search keywords, models, tags, or sources..." oninput="handleSearch()">
      </div>
      <div class="filters">
        <button class="filter-tab active" data-source="all" onclick="setFilter('all')">All</button>
        <button class="filter-tab" data-source="github" onclick="setFilter('github')">GitHub</button>
        <button class="filter-tab" data-source="hackernews" onclick="setFilter('hackernews')">HackerNews</button>
        <button class="filter-tab" data-source="x/twitter" onclick="setFilter('x/twitter')">X/Twitter</button>
        <button class="filter-tab" data-source="manual" onclick="setFilter('manual')">Manual</button>
      </div>
      <div class="sorter">
        <label for="sort-select">Sort by:</label>
        <select id="sort-select" onchange="handleSort()">
          <option value="score-desc">Score: High to Low</option>
          <option value="fit-desc">Workspace Fit</option>
          <option value="name-asc">Name: A to Z</option>
        </select>
      </div>
    </div>

    <div id="feed-container" class="feed-grid">
      <!-- Items dynamically populated by JS -->
    </div>

    <footer class="feed-footer">
      <p>rAIdar is an open source AI helper tool. All scanned options are evaluated programmatically or via local heuristics.</p>
    </footer>
  </div>

  <script>
    // Embedded items data
    const items = ${JSON.stringify(items)};
    
    const DEPLOY_THRESHOLD = ${deployThreshold};
    const TEST_THRESHOLD = ${testThreshold};
    const BOOKMARK_THRESHOLD = ${bookmarkThreshold};

    let activeFilter = 'all';
    let searchQuery = '';
    let activeSort = 'score-desc';

    function getScoreClass(score) {
      if (score >= DEPLOY_THRESHOLD) return 'deploy';
      if (score >= TEST_THRESHOLD) return 'test';
      if (score >= BOOKMARK_THRESHOLD) return 'bookmark';
      return 'deprioritized';
    }

    function getScoreLabel(score) {
      if (score >= DEPLOY_THRESHOLD) return 'Deploy Now';
      if (score >= TEST_THRESHOLD) return 'Test Soon';
      if (score >= BOOKMARK_THRESHOLD) return 'Bookmark';
      return 'Ignore';
    }

    function formatAccessType(type) {
      return type.replace('_', ' ');
    }

    function formatRoute(r) {
      const parts = [];
      parts.push(formatAccessType(r.accessType));
      if (r.openAICompatible) parts.push("OpenAI-compatible");
      if (r.requiresApiKey) parts.push("API key required");
      else if (r.requiresApiKey === false) parts.push("no API key");
      if (r.requiresCreditCard) parts.push("credit card required");
      else if (r.requiresCreditCard === false) parts.push("no credit card");
      parts.push(r.setupDifficulty + " setup");
      if (r.quota) parts.push("quota: " + r.quota);
      return r.provider + " — " + parts.join(", ") + (r.notes ? " (" + r.notes + ")" : "");
    }

    function renderFeed() {
      const container = document.getElementById('feed-container');
      
      // Filter items
      let filtered = items.filter(item => {
        // Source Filter
        if (activeFilter !== 'all') {
          const matchSource = item.source.toLowerCase() === activeFilter || 
                              (activeFilter === 'x/twitter' && item.source.toLowerCase() === 'x/twitter') ||
                              (activeFilter === 'hackernews' && item.source.toLowerCase() === 'hackernews');
          if (!matchSource) return false;
        }

        // Search Filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchText = item.name.toLowerCase().includes(q) || 
                            item.description.toLowerCase().includes(q) || 
                            (item.whyItMatters && item.whyItMatters.toLowerCase().includes(q)) || 
                            item.tags.some(t => t.toLowerCase().includes(q)) ||
                            item.source.toLowerCase().includes(q);
          if (!matchText) return false;
        }

        return true;
      });

      // Sort items
      filtered.sort((a, b) => {
        if (activeSort === 'score-desc') return b.score - a.score;
        if (activeSort === 'fit-desc') return b.workspaceFit - a.workspaceFit;
        if (activeSort === 'name-asc') return a.name.localeCompare(b.name);
        return 0;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="no-results">No signals match your filter and search criteria.</div>';
        return;
      }

      container.innerHTML = filtered.map(item => {
        const scoreClass = getScoreClass(item.score);
        const scoreLabel = getScoreLabel(item.score);
        
        const tagsHtml = item.tags.map(t => \`<span class="tag-pill">\${t}</span>\`).join('');
        
        let routesRowsHtml = '';
        if (item.accessRoutes && item.accessRoutes.length > 0) {
          routesRowsHtml = item.accessRoutes.map(r => \`
            <div class="route-row">
              <span class="route-name">\${r.provider}</span>
              <span class="route-details">\${formatAccessType(r.accessType)} (\${r.setupDifficulty} setup, \${r.requiresApiKey ? 'API Key' : 'No Key'})</span>
            </div>
          \`).join('');
        } else {
          routesRowsHtml = '<div class="route-row"><span class="route-name">Unclear</span><span class="route-details">Pricing or access routes are hidden.</span></div>';
        }

        // Domain extraction for cleaner display
        let domain = '';
        try {
          domain = new URL(item.url).hostname.replace('www.', '');
        } catch(e) {
          domain = item.url;
        }

        return \`
          <div class="feed-card">
            <div class="card-glow"></div>
            <div class="card-header">
              <div class="card-meta">
                <span class="source-tag">
                  📡 \u00A0 \${item.source} ( <a href="\${item.url}" target="_blank">\${domain}</a> )
                </span>
                <h3 class="card-title">\${item.name}</h3>
              </div>
              <div class="score-badge-container">
                <div class="score-badge \${scoreClass}">\${item.score.toFixed(1)}</div>
                <span class="score-label">\${scoreLabel}</span>
              </div>
            </div>

            <div class="tags">\${tagsHtml}</div>

            <p class="card-description">\${item.description}</p>

            <div class="highlight-section">
              <div class="highlight-item">
                <span class="highlight-title">Why it matters</span>
                <span class="highlight-body">\${item.whyItMatters || item.description}</span>
              </div>
              <div class="highlight-item">
                <span class="highlight-title">Workspace Fit</span>
                <span class="highlight-body">\${item.contextSummary || 'Generic workflow usefulness.'}</span>
              </div>
            </div>

            <div class="routes-detail">
              <div class="routes-title">Scouted Access Routes</div>
              \${routesRowsHtml}
            </div>

            <div class="action-block">
              <div class="next-step">
                <span>✓</span>
                Next: \${item.nextAction || 'Review docs.'}
              </div>
              \${item.risk ? \`
              <div class="risk-info">
                ⚠️ Risk: \${item.risk}
              </div>
              \` : ''}
            </div>
          </div>
        \`;
      }).join('');
    }

    function setFilter(source) {
      activeFilter = source;
      document.querySelectorAll('.filter-tab').forEach(tab => {
        const ds = tab.getAttribute('data-source');
        if (ds === source) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
      renderFeed();
    }

    function handleSearch() {
      searchQuery = document.getElementById('search-input').value;
      renderFeed();
    }

    function handleSort() {
      activeSort = document.getElementById('sort-select').value;
      renderFeed();
    }

    // Initial render
    renderFeed();
  </script>
</body>
</html>
`;
  return html;
}
