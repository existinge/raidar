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
