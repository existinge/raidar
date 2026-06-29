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
      /* Dark Theme (Default) */
      --bg-color: #0b0f19;
      --panel-bg: rgba(22, 28, 45, 0.4);
      --panel-border: rgba(255, 255, 255, 0.08);
      --card-bg: rgba(20, 26, 40, 0.5);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --accent-primary: #8b5cf6;
      --accent-primary-glow: rgba(139, 92, 246, 0.15);
      --accent-secondary: #06b6d4;
      --accent-success: #10b981;
      --accent-success-glow: rgba(16, 185, 129, 0.15);
      --accent-warning: #f59e0b;
      --shadow-color: rgba(0, 0, 0, 0.4);
      --card-hover-border: rgba(139, 92, 246, 0.3);
      --input-bg: rgba(15, 23, 42, 0.6);
      --tab-bg: rgba(30, 41, 59, 0.5);
      --stat-bg: rgba(22, 28, 45, 0.4);
    }

    body.light-theme {
      /* Light Theme (Calm Off-white Day Mode) */
      --bg-color: #f7f6f3;
      --panel-bg: rgba(255, 255, 255, 0.85);
      --panel-border: rgba(15, 23, 42, 0.06);
      --card-bg: #ffffff;
      --text-main: #2d3748;
      --text-muted: #718096;
      --accent-primary: #6d28d9;
      --accent-primary-glow: rgba(109, 40, 217, 0.08);
      --accent-secondary: #0891b2;
      --accent-success: #059669;
      --accent-success-glow: rgba(5, 150, 105, 0.08);
      --accent-warning: #d97706;
      --shadow-color: rgba(15, 23, 42, 0.03);
      --card-hover-border: rgba(109, 40, 217, 0.25);
      --input-bg: rgba(255, 255, 255, 0.9);
      --tab-bg: rgba(15, 23, 42, 0.04);
      --stat-bg: #ffffff;
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
      padding: 1.5rem 1rem;
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.03) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.03) 0%, transparent 40%);
      background-attachment: fixed;
      transition: background-color 0.4s, color 0.4s;
    }

    header {
      max-width: 1000px;
      margin: 0 auto 1.5rem auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 1rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .radar-icon-container {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .brand-text h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      font-weight: 800;
      background: linear-gradient(to right, var(--text-main), var(--accent-primary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-text p {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 0.1rem;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .scan-date {
      text-align: right;
    }

    .scan-date span {
      display: block;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .scan-date strong {
      font-family: 'Outfit', sans-serif;
      font-size: 0.9rem;
      color: var(--text-main);
    }

    /* Theme Toggle */
    .theme-toggle {
      background: var(--tab-bg);
      border: 1px solid var(--panel-border);
      color: var(--text-main);
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
    }

    .theme-toggle:hover {
      border-color: var(--accent-primary);
      color: var(--accent-primary);
    }

    .theme-toggle .sun-icon { display: none; width: 1.1rem; height: 1.1rem; }
    .theme-toggle .moon-icon { display: block; width: 1.1rem; height: 1.1rem; }

    body.light-theme .theme-toggle .sun-icon { display: block; }
    body.light-theme .theme-toggle .moon-icon { display: none; }

    .container {
      max-width: 1000px;
      margin: 0 auto;
    }

    /* Context Banner */
    .context-banner {
      background: rgba(99, 102, 241, 0.05);
      border: 1px solid rgba(99, 102, 241, 0.12);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      margin-bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .context-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--accent-primary);
    }

    .context-header span {
      background: var(--accent-primary);
      color: white;
      font-size: 0.65rem;
      padding: 0.1rem 0.4rem;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .context-body {
      font-size: 0.85rem;
      line-height: 1.4;
      color: var(--text-main);
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .stat-card {
      background: var(--stat-bg);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 0.85rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 10px var(--shadow-color);
      transition: background-color 0.4s, border-color 0.4s;
    }

    .stat-card.deploy { border-left: 3px solid var(--accent-success); }
    .stat-card.test { border-left: 3px solid var(--accent-secondary); }
    .stat-card.bookmark { border-left: 3px solid var(--accent-warning); }

    .stat-info span {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .stat-info h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 1.35rem;
      font-weight: 700;
      margin-top: 0.15rem;
    }

    .stat-icon {
      font-size: 1.15rem;
      opacity: 0.6;
    }

    /* Controls */
    .controls {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      margin-bottom: 1.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
      backdrop-filter: blur(8px);
    }

    .search-box {
      position: relative;
      flex-grow: 1;
      min-width: 200px;
    }

    .search-box input {
      width: 100%;
      padding: 0.5rem 0.8rem 0.5rem 2.2rem;
      border-radius: 6px;
      border: 1px solid var(--panel-border);
      background: var(--input-bg);
      color: var(--text-main);
      font-size: 0.85rem;
      outline: none;
      transition: all 0.3s;
    }

    .search-box input:focus {
      border-color: var(--accent-primary);
    }

    .search-box::before {
      content: "🔍";
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.8rem;
      opacity: 0.5;
    }

    .filters {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .filter-tab {
      background: var(--tab-bg);
      border: 1px solid var(--panel-border);
      color: var(--text-muted);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: all 0.3s;
    }

    .filter-tab:hover {
      color: var(--text-main);
    }

    .filter-tab.active {
      background: var(--accent-primary);
      color: white;
      border-color: var(--accent-primary);
    }

    .sorter {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .sorter select {
      background: var(--input-bg);
      border: 1px solid var(--panel-border);
      color: var(--text-main);
      padding: 0.3rem 0.6rem;
      border-radius: 5px;
      outline: none;
      cursor: pointer;
      font-size: 0.8rem;
    }

    /* Feed Grid */
    .feed-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    /* Card Styling (Compact & Calm) */
    .feed-card {
      background: var(--card-bg);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 1.1rem;
      box-shadow: 0 2px 12px var(--shadow-color);
      transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .feed-card:hover {
      border-color: var(--card-hover-border);
      box-shadow: 0 4px 18px rgba(109, 40, 217, 0.05);
    }

    /* Side-by-side Content layout */
    .card-body-wrapper {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }

    .card-text-content {
      flex-grow: 1;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
      gap: 1rem;
    }

    .card-meta {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .source-tag {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent-secondary);
      display: flex;
      align-items: center;
      gap: 0.3rem;
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
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main);
    }

    /* Compact Score Display */
    .score-badge-container {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .score-badge {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      background: var(--input-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Outfit', sans-serif;
      font-size: 0.95rem;
      font-weight: 800;
      border: 2px solid #ccc;
    }

    .score-badge.deploy {
      border-color: var(--accent-success);
      color: var(--accent-success);
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
      font-size: 0.55rem;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-top: 0.15rem;
      font-weight: 600;
      letter-spacing: 0.05em;
    }

    /* Thumbnail attachments */
    .card-image-container {
      flex-shrink: 0;
      width: 90px;
      height: 90px;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid var(--panel-border);
      background: var(--input-bg);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-image-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .card-image-container.placeholder svg {
      width: 100%;
      height: 100%;
    }

    /* Tags */
    .tags {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
      margin-bottom: 0.5rem;
    }

    .tag-pill {
      background: var(--tab-bg);
      border: 1px solid var(--panel-border);
      color: var(--text-muted);
      font-size: 0.7rem;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
    }

    .card-description {
      font-size: 0.85rem;
      line-height: 1.5;
      color: var(--text-main);
      margin-bottom: 0.75rem;
      opacity: 0.95;
    }

    /* Highlights Section */
    .highlight-section {
      background: var(--tab-bg);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 0.6rem 0.8rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    @media (min-width: 768px) {
      .highlight-section {
        flex-direction: row;
        justify-content: space-between;
      }
      .highlight-item {
        width: 48%;
      }
    }

    .highlight-item {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .highlight-title {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent-primary);
    }

    .highlight-body {
      font-size: 0.8rem;
      line-height: 1.4;
      color: var(--text-main);
    }

    /* Community Hype Scorer UI */
    .hype-section {
      background: rgba(99, 102, 241, 0.03);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }

    body.light-theme .hype-section {
      background: rgba(109, 40, 217, 0.02);
    }

    .hype-score-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .hype-level-pill {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .hype-level-pill.niche { background: rgba(148, 163, 184, 0.12); color: var(--text-muted); }
    .hype-level-pill.growing { background: rgba(6, 182, 212, 0.12); color: var(--accent-secondary); }
    .hype-level-pill.surging { background: rgba(245, 158, 11, 0.12); color: var(--accent-warning); }
    .hype-level-pill.mainstream { background: rgba(16, 185, 129, 0.12); color: var(--accent-success); }

    .hype-numerical {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--text-main);
    }

    .hype-breakdown {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-style: italic;
      flex-grow: 1;
      text-align: right;
    }

    /* Access routes detail */
    .routes-detail {
      background: var(--input-bg);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 0.6rem 0.8rem;
    }

    .routes-title {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent-secondary);
      margin-bottom: 0.3rem;
    }

    .route-row {
      display: flex;
      justify-content: space-between;
      padding: 0.25rem 0;
      border-bottom: 1px solid var(--panel-border);
      font-size: 0.8rem;
    }

    .route-row:last-child {
      border-bottom: none;
    }

    .route-name {
      font-weight: 500;
      color: var(--text-main);
    }

    .route-details {
      color: var(--text-muted);
      text-align: right;
    }

    /* Action block */
    .action-block {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.6rem;
      border-top: 1px solid var(--panel-border);
    }

    .next-step {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-main);
    }

    .next-step span {
      background: var(--accent-success);
      color: white;
      width: 1.1rem;
      height: 1.1rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      font-weight: 800;
    }

    body.light-theme .next-step span {
      background: var(--accent-success);
      color: white;
    }

    .risk-info {
      font-size: 0.75rem;
      color: #ef4444;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      opacity: 0.9;
    }

    body.light-theme .risk-info {
      color: #dc2626;
    }

    .no-results {
      text-align: center;
      padding: 3rem 1.5rem;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    footer.feed-footer {
      max-width: 1000px;
      margin: 3rem auto 0 auto;
      text-align: center;
      padding-top: 1rem;
      border-top: 1px solid var(--panel-border);
      color: var(--text-muted);
      font-size: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="radar-icon-container">
          <!-- Cute Mascot Logo: smiling AI radar dish -->
          <svg viewBox="0 0 100 100" class="radar-mascot-svg" width="48" height="48">
            <defs>
              <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="var(--accent-primary)" />
                <stop offset="100%" stop-color="var(--accent-secondary)" />
              </linearGradient>
            </defs>
            <!-- Mascot body (Cute Radar Dish) -->
            <path d="M20 70 A35 35 0 0 1 80 70" fill="none" stroke="url(#logo-grad)" stroke-width="8" stroke-linecap="round"/>
            <path d="M30 70 A25 25 0 0 1 70 70" fill="none" stroke="url(#logo-grad)" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
            
            <!-- Base stand -->
            <line x1="50" y1="70" x2="50" y2="88" stroke="url(#logo-grad)" stroke-width="6" stroke-linecap="round"/>
            <path d="M35 88 C40 88 45 88 50 88 C55 88 60 88 65 88" fill="none" stroke="url(#logo-grad)" stroke-width="6" stroke-linecap="round"/>

            <!-- Face details (Cute blinking robot eyes) -->
            <circle cx="42" cy="58" r="3.5" fill="var(--text-main)" />
            <circle cx="58" cy="58" r="3.5" fill="var(--text-main)" />
            <!-- Cute Little Smile -->
            <path d="M47 64 Q50 67 53 64" fill="none" stroke="var(--text-main)" stroke-width="2.5" stroke-linecap="round"/>
            
            <!-- Cute mini blushing cheeks -->
            <circle cx="36" cy="61" r="2" fill="#f43f5e" opacity="0.6"/>
            <circle cx="64" cy="61" r="2" fill="#f43f5e" opacity="0.6"/>

            <!-- Signal scan wave (pulsing top) -->
            <path d="M40 38 Q50 32 60 38" fill="none" stroke="var(--accent-secondary)" stroke-width="3" stroke-linecap="round"/>
            <path d="M45 28 Q50 24 55 28" fill="none" stroke="var(--accent-primary)" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="brand-text">
          <h1>rAIdar Daily Report</h1>
          <p>Scouting accessible AI tools, models, and MCP enhancements</p>
        </div>
      </div>
      <div class="header-actions">
        <div class="scan-date">
          <span>Report Generated</span>
          <strong>${dateStr}</strong>
        </div>
        <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle light/dark theme">
          <!-- Sun Icon (Light Mode) -->
          <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <!-- Moon Icon (Dark Mode) -->
          <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
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
          <option value="hype-desc">Community Hype</option>
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

    // Theme logic
    function initTheme() {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
      } else if (savedTheme === 'dark') {
        document.body.classList.remove('light-theme');
      } else {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          document.body.classList.add('light-theme');
        }
      }
    }
    
    function toggleTheme() {
      if (document.body.classList.contains('light-theme')) {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
      } else {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
      }
    }

    // Call initTheme immediately
    initTheme();

    function getScoreClass(score) {
      if (score >= DEPLOY_THRESHOLD) return 'deploy';
      if (score >= TEST_THRESHOLD) return 'test';
      if (score >= BOOKMARK_THRESHOLD) return 'bookmark';
      return 'deprioritized';
    }

    function getScoreLabel(score) {
      if (score >= DEPLOY_THRESHOLD) return 'Deploy';
      if (score >= TEST_THRESHOLD) return 'Test';
      if (score >= BOOKMARK_THRESHOLD) return 'Bookmark';
      return 'Ignore';
    }

    function formatAccessType(type) {
      return type.replace('_', ' ');
    }

    function getHypeIcon(level) {
      switch (level) {
        case 'mainstream': return '💎';
        case 'surging': return '🔥';
        case 'growing': return '📈';
        case 'niche': return '🌱';
        default: return '📈';
      }
    }

    function getHypeLabel(level) {
      switch (level) {
        case 'mainstream': return 'Mainstream';
        case 'surging': return 'Surging';
        case 'growing': return 'Growing';
        case 'niche': return 'Niche';
        default: return 'Growing';
      }
    }

    function getCardImageHtml(item) {
      if (item.image) {
        return \`<div class="card-image-container"><img src="\${item.image}" alt="\${item.name}"></div>\`;
      }
      
      // Draw quiet, abstract geometric SVG if no image
      return \`
        <div class="card-image-container placeholder">
          <svg viewBox="0 0 100 100">
            <defs>
              <linearGradient id="grad-\${item.id}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.08" />
                <stop offset="100%" stop-color="var(--accent-secondary)" stop-opacity="0.18" />
              </linearGradient>
            </defs>
            <rect width="100" height="100" fill="url(#grad-\${item.id})" />
            <circle cx="50" cy="50" r="16" fill="none" stroke="var(--accent-primary)" stroke-width="0.75" stroke-dasharray="3 3"/>
            <circle cx="50" cy="50" r="8" fill="var(--accent-secondary)" opacity="0.25"/>
            <line x1="15" y1="50" x2="85" y2="50" stroke="var(--accent-primary)" stroke-width="0.5" opacity="0.15"/>
            <line x1="50" y1="15" x2="50" y2="85" stroke="var(--accent-primary)" stroke-width="0.5" opacity="0.15"/>
          </svg>
        </div>
      \`;
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
        if (activeSort === 'hype-desc') {
          const hypeA = a.communityHype ? a.communityHype.score : 0;
          const hypeB = b.communityHype ? b.communityHype.score : 0;
          return hypeB - hypeA;
        }
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

        const imageHtml = getCardImageHtml(item);
        
        // Hype details
        const hypeObj = item.communityHype || { score: 5.0, level: 'growing', sentiment: 'neutral', breakdown: 'Moderate interest.' };
        const hypeIcon = getHypeIcon(hypeObj.level);
        const hypeLabel = getHypeLabel(hypeObj.level);

        return \`
          <div class="feed-card">
            <div class="card-body-wrapper">
              <div class="card-text-content">
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
              </div>
              \${imageHtml}
            </div>

            <!-- Community Hype Panel -->
            <div class="hype-section">
              <div class="hype-score-container">
                <span class="hype-level-pill \${hypeObj.level}">
                  \${hypeIcon} \${hypeLabel}
                </span>
                <span class="hype-numerical">Score: \${hypeObj.score.toFixed(1)}/10</span>
              </div>
              <span class="hype-breakdown">\${hypeObj.breakdown}</span>
            </div>

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
