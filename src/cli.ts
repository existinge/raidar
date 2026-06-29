#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "./config.js";
import { scanAll } from "./scanner.js";
import { scoreSignal } from "./scoring.js";
import { generateMarkdownBrief, generateHtmlFeed } from "./output.js";

const program = new Command();

program
  .name("raidar")
  .description("CLI-first AI workflow radar and access scout")
  .version("1.0.0");

/**
 * Common logic to read context from string or file
 */
function resolveContext(options: { context?: string; contextFile?: string }): string | undefined {
  let contextText = options.context || "";

  if (options.contextFile) {
    const filePath = path.resolve(options.contextFile);
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        contextText = contextText 
          ? `${contextText}\n\nWorkspace Context File:\n${fileContent}` 
          : fileContent;
      } catch (error: any) {
        console.warn(`Could not read context file at ${filePath}: ${error.message}`);
      }
    } else {
      console.log(`Context file not found at ${filePath}. Continuing without it.`);
    }
  }

  return contextText.trim() || undefined;
}

/**
 * Evaluates candidate signals in parallel batches to prevent timeouts on local models.
 */
async function scoreCandidatesInBatches(candidates: any[], config: any, context: string | undefined): Promise<any[]> {
  const scoredItems: any[] = [];
  const chunkSize = 1;
  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    console.log(`Scoring candidates ${i + 1} to ${Math.min(i + chunkSize, candidates.length)} of ${candidates.length}...`);
    const chunkResults = await Promise.all(
      chunk.map(item => scoreSignal(item, config, context))
    );
    scoredItems.push(...chunkResults);
  }
  return scoredItems;
}

/**
 * scan command logic
 */
program
  .command("scan")
  .description("Scan active sources (GitHub, HackerNews, manual items) for AI workflow signals")
  .option("-c, --context <text>", "Provide runtime context text for scoring")
  .option("-f, --context-file <path>", "Path to workspace context file (e.g. ./.agent/workspace-summary.md)")
  .option("--include-context", "Include raw runtime context in generated report files", false)
  .option("-o, --output <path>", "File to output the Markdown brief to", "radar-brief.md")
  .option("-html, --html-output <path>", "File to output the HTML feed to", "radar-feed.html")
  .action(async (options) => {
    console.log("rAIdar Access Scout: Beginning scan...");
    
    // Load config
    const config = loadConfig();
    
    // Resolve context
    const context = resolveContext(options);
    
    // Scan all sources with context parameter
    const candidates = await scanAll(config, context);
    console.log(`Discovered ${candidates.length} candidate signals.`);

    // Score candidates in parallel batches
    const scoredItems = await scoreCandidatesInBatches(candidates, config, context);

    // Format output Markdown
    const reportContext = options.includeContext ? context : undefined;
    const md = generateMarkdownBrief(scoredItems, config, reportContext);
    
    // Format output HTML Feed
    const html = generateHtmlFeed(scoredItems, config, reportContext);
    
    // Write Markdown file
    const outputPath = path.resolve(options.output);
    try {
      fs.writeFileSync(outputPath, md, "utf-8");
      console.log(`Scan brief saved to ${outputPath}`);
    } catch (err: any) {
      console.error(`Failed to write markdown brief: ${err.message}`);
    }

    // Write HTML file
    const htmlOutputPath = path.resolve(options.htmlOutput);
    try {
      fs.writeFileSync(htmlOutputPath, html, "utf-8");
      console.log(`Scan HTML feed saved to ${htmlOutputPath}`);
    } catch (err: any) {
      console.error(`Failed to write HTML feed: ${err.message}`);
    }

    console.log("\n--- Brief Summary ---");
    // Print top 3 recommendations to stdout
    const top3 = scoredItems.sort((a,b) => b.score - a.score).slice(0, 3);
    if (top3.length > 0) {
      top3.forEach((item, index) => {
        console.log(`${index + 1}. [Score: ${item.score}/10] ${item.name} (${item.bestAccessRoute?.provider} - ${item.bestAccessRoute?.accessType})`);
      });
    } else {
      console.log("No signal items found matching thresholds.");
    }
  });

/**
 * recommend command logic
 */
program
  .command("recommend")
  .description("Show workflow recommendations based on scanned signals and context")
  .option("-c, --context <text>", "Provide runtime context text for scoring")
  .option("-f, --context-file <path>", "Path to workspace context file (e.g. ./.agent/workspace-summary.md)")
  .action(async (options) => {
    console.log("rAIdar Access Scout: Finding top recommendations...");
    
    const config = loadConfig();
    const context = resolveContext(options);
    
    const candidates = await scanAll(config, context);
    // Score candidates in parallel batches
    const scoredItems = await scoreCandidatesInBatches(candidates, config, context);

    // Sort by score
    scoredItems.sort((a, b) => b.score - a.score);
    
    const deployThreshold = config.thresholds.deployNow || 8.5;
    const testThreshold = config.thresholds.testSoon || 7.0;

    const recommendItems = scoredItems.filter(item => item.score >= testThreshold);

    console.log(`\nFound ${recommendItems.length} recommendations above threshold of ${testThreshold}:`);
    console.log("=".repeat(50));
    
    if (recommendItems.length === 0) {
      console.log("No items recommended based on your current thresholds.");
      return;
    }

    recommendItems.forEach((item, i) => {
      const deployPrefix = item.score >= deployThreshold ? "[DEPLOY NOW] " : "[TEST SOON] ";
      console.log(`\n${i + 1}. ${deployPrefix}${item.name} (Score: ${item.score}/10)`);
      console.log(`   URL: ${item.url}`);
      console.log(`   Best Access: ${item.bestAccessRoute?.provider} (${item.bestAccessRoute?.accessType})`);
      console.log(`   Workspace Fit: ${item.contextSummary || "Standard workflow usefulness"}`);
      console.log(`   Next Step: ${item.nextAction}`);
    });
  });

program.parse(process.argv);
