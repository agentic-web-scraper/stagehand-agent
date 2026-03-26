'use strict';

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';

dotenv.config();

const stagehandopts = {
  env: "LOCAL",
  localBrowserLaunchOptions: {
    headless: false,
    viewport: { width: 1280, height: 720 },
  },
  verbose: 2,  // Show agent thinking and planning
  experimental: true,
  disableAPI: true,
};

console.log("🧠 True Agentic Web Scraper");
console.log("=" + "=".repeat(79));
console.log("🤖 Agent will plan, think, and adapt autonomously");
console.log("=" + "=".repeat(79) + "\n");

const userPrompt = process.argv[2];
const targetUrl = process.argv[3];
const maxSteps = parseInt(process.argv[4]) || 30;

if (!userPrompt || !targetUrl) {
  console.log("❌ Usage: node tests/agentic_scraper.js \"<task>\" \"<url>\" [maxSteps]\n");
  console.log("📝 Examples:");
  console.log('  node tests/agentic_scraper.js "Scrape the top 10 stories with their titles and points" "https://news.ycombinator.com"');
  console.log('  node tests/agentic_scraper.js "Find all products under $50 and get their names and prices" "https://example.com/shop"');
  console.log('  node tests/agentic_scraper.js "Get article titles from the first 3 pages" "https://blog.example.com"');
  process.exit(1);
}

console.log(`💬 Task: "${userPrompt}"`);
console.log(`🌐 URL: ${targetUrl}`);
console.log(`🎯 Max steps: ${maxSteps}\n`);

(async () => {
  let stagehand;

  try {
    console.log("🚀 Initializing agent...");
    stagehand = new Stagehand(stagehandopts);
    await stagehand.init();
    console.log("✅ Agent ready\n");
    
    const page = stagehand.context.pages()[0];
    
    console.log("🌐 Navigating to target...");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ Page loaded\n");

    console.log("=" + "=".repeat(79));
    console.log("🧠 AGENT STARTING - Autonomous Planning & Execution");
    console.log("=" + "=".repeat(79) + "\n");

    // Create the agent with OpenAI-compatible model (NVIDIA NIM)
    const agent = stagehand.agent({
      model: {
        modelName: "openai/gpt-4o",  // Use OpenAI format
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: process.env.NVIDIA_BASE_URL,
      },
      systemPrompt: `You are an expert web scraping agent with the ability to:
- Observe and understand webpage structures
- Plan multi-step scraping strategies
- Extract structured data
- Navigate through pagination
- Adapt your approach based on what you find

Think step-by-step and explain your reasoning. When you encounter pagination, navigate through multiple pages to collect comprehensive data.`,
      mode: "dom",
    });

    // Define output schema
    const OutputSchema = z.object({
      data: z.array(z.record(z.string(), z.any())).describe("Array of extracted items"),
      totalItems: z.number().describe("Total number of items extracted"),
      pagesVisited: z.number().optional().describe("Number of pages visited"),
      summary: z.string().describe("Summary of what was accomplished"),
    });

    console.log("🎯 Agent executing task...\n");
    console.log("💭 The agent will now:");
    console.log("   1. Analyze the page structure");
    console.log("   2. Plan the extraction strategy");
    console.log("   3. Execute the plan step-by-step");
    console.log("   4. Adapt based on what it finds");
    console.log("   5. Navigate pagination if needed\n");
    console.log("-".repeat(80) + "\n");
    
    // Execute the autonomous task
    const result = await agent.execute({
      instruction: userPrompt,
      maxSteps: maxSteps,
      output: OutputSchema,
      highlightCursor: true,  // Visual feedback
    });

    console.log("\n" + "=".repeat(80));
    console.log("✅ AGENT COMPLETED");
    console.log("=".repeat(80) + "\n");

    if (result.output) {
      console.log("📊 RESULTS:");
      console.log("-".repeat(80));
      console.log(`📝 Summary: ${result.output.summary}`);
      console.log(`📰 Total Items: ${result.output.totalItems}`);
      if (result.output.pagesVisited) {
        console.log(`📄 Pages Visited: ${result.output.pagesVisited}`);
      }
      
      console.log("\n🎯 Extracted Data (first 10):");
      console.log("-".repeat(80));
      
      result.output.data.slice(0, 10).forEach((item, i) => {
        console.log(`\n${i + 1}.`);
        Object.entries(item).forEach(([key, value]) => {
          const displayValue = typeof value === 'string' && value.length > 70 
            ? value.substring(0, 70) + "..." 
            : value;
          console.log(`   ${key}: ${displayValue}`);
        });
      });

      if (result.output.data.length > 10) {
        console.log(`\n... and ${result.output.data.length - 10} more items`);
      }

      // Show agent's reasoning
      if (result.messages && result.messages.length > 0) {
        console.log("\n🧠 Agent's Reasoning Process:");
        console.log("-".repeat(80));
        result.messages.slice(0, 5).forEach((msg, i) => {
          if (msg.role === 'assistant' && msg.content) {
            console.log(`\nStep ${i + 1}: ${msg.content.substring(0, 200)}...`);
          }
        });
      }

      // Save results
      const fs = await import('fs/promises');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `agentic-results-${timestamp}.json`;
      
      const output = {
        task: userPrompt,
        url: targetUrl,
        timestamp: new Date().toISOString(),
        result: result.output,
        agentMessages: result.messages,
      };
      
      await fs.writeFile(filename, JSON.stringify(output, null, 2));
      console.log(`\n💾 Full results and agent reasoning saved to: ${filename}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("🎉 Agentic scraping completed!");
    console.log("=".repeat(80));

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.stack) {
      console.error("\n📋 Stack trace:");
      console.error(error.stack);
    }
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
        console.log("\n🧹 Browser closed");
      } catch (e) {
        // Ignore close errors
      }
    }
  }
})();
