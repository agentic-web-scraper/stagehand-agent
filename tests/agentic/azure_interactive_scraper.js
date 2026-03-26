'use strict';

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

console.log("🤖 Azure OpenAI Interactive Scraper");
console.log("=" + "=".repeat(79));
console.log("☁️  Powered by Azure OpenAI (GPT-4o mini)");
console.log("💬 Give me a URL and tell me what to scrape!");
console.log("=" + "=".repeat(79) + "\n");

// Create readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

(async () => {
  let stagehand;

  try {
    // Get URL from user
    const targetUrl = await question("🌐 Enter the URL to scrape: ");
    if (!targetUrl || !targetUrl.startsWith('http')) {
      console.log("❌ Please provide a valid URL starting with http:// or https://");
      rl.close();
      return;
    }

    // Get task from user
    const userTask = await question("\n💬 What do you want to scrape?\n   (e.g., 'Get all product names and prices', 'Extract top 20 articles')\n   → ");
    if (!userTask) {
      console.log("❌ Please provide a task description");
      rl.close();
      return;
    }

    // Ask about pagination
    const needsPagination = await question("\n📄 Do you need pagination? (yes/no): ");
    const maxPages = needsPagination.toLowerCase().startsWith('y') 
      ? parseInt(await question("   How many pages? (default 3): ") || "3")
      : 1;

    // Ask about max steps
    const maxSteps = parseInt(await question("\n🎯 Max steps for agent? (default 50): ") || "50");

    console.log("\n" + "=".repeat(80));
    console.log("📋 TASK SUMMARY");
    console.log("=".repeat(80));
    console.log(`🌐 URL: ${targetUrl}`);
    console.log(`💬 Task: ${userTask}`);
    console.log(`📄 Pages: ${maxPages}`);
    console.log(`🎯 Max steps: ${maxSteps}`);
    console.log("=".repeat(80) + "\n");

    const confirm = await question("▶️  Start scraping? (yes/no): ");
    if (!confirm.toLowerCase().startsWith('y')) {
      console.log("❌ Cancelled");
      rl.close();
      return;
    }

    rl.close(); // Close readline before starting browser

    console.log("\n🚀 Initializing Stagehand with Azure OpenAI...");
    
    stagehand = new Stagehand({
      env: "LOCAL",
      localBrowserLaunchOptions: {
        headless: false,
        viewport: { width: 1280, height: 720 },
      },
      model: "azure/gpt-4o-mini",
      verbose: 2,
      experimental: true,
      disableAPI: true,
    });

    await stagehand.init();
    console.log("✅ Agent initialized\n");
    
    const page = stagehand.context.pages()[0];
    
    console.log("🌐 Navigating to target...");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ Page loaded\n");

    console.log("=" + "=".repeat(79));
    console.log("🧠 AGENT STARTING");
    console.log("=" + "=".repeat(79) + "\n");

    // Build system prompt based on pagination needs
    const systemPrompt = maxPages > 1 
      ? `You are an expert web scraping agent specialized in multi-page data extraction.

CORE ABILITIES:
1. OBSERVE: Analyze webpage structure and identify data patterns
2. EXTRACT: Pull structured data from current page
3. NAVIGATE: Find and click pagination controls (More, Next, page numbers)
4. TRACK: Keep count of pages visited and items collected
5. ADAPT: Adjust strategy based on page structure

PAGINATION INSTRUCTIONS:
- Extract data from the CURRENT page first
- Look for pagination controls: "More", "Next", page numbers, arrow buttons
- Click the pagination control to go to the next page
- Wait for the new page to load
- Extract data from the new page
- Repeat until you've visited ${maxPages} pages OR no more pagination exists
- Keep track of total items collected across all pages

CURRENT TASK: ${userTask}

Remember: Visit multiple pages and collect comprehensive data!`
      : `You are an expert web scraping agent.

CORE ABILITIES:
1. OBSERVE: Analyze webpage structure and identify data patterns
2. EXTRACT: Pull structured data with precision
3. ADAPT: Adjust your approach based on page structure

CURRENT TASK: ${userTask}

Remember: Be thorough and extract all requested data!`;

    // Create agent with Azure OpenAI
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",
      systemPrompt: systemPrompt,
      mode: "dom",
    });

    // Define flexible output schema
    const OutputSchema = z.object({
      data: z.array(z.record(z.string(), z.any())).describe("Array of all extracted items"),
      totalItems: z.number().describe("Total number of items extracted"),
      pagesVisited: z.number().optional().describe("Number of pages visited (if pagination was used)"),
      strategy: z.string().describe("Explanation of the extraction strategy used"),
      summary: z.string().describe("Summary of what was accomplished"),
      completionStatus: z.enum(["complete", "partial", "failed"]).describe("Status of task completion"),
      paginationMethod: z.string().optional().describe("How pagination was handled (if applicable)"),
    });

    console.log("🎯 Agent executing your task...\n");
    
    // Execute autonomous task
    const instruction = maxPages > 1
      ? `${userTask}. You MUST navigate through multiple pages (up to ${maxPages} pages) and collect data from each page. Use pagination controls like "More", "Next", or page numbers to navigate.`
      : userTask;

    const result = await agent.execute({
      instruction: instruction,
      maxSteps: maxSteps,
      output: OutputSchema,
      highlightCursor: true,
    });

    console.log("\n" + "=".repeat(80));
    console.log("✅ AGENT COMPLETED");
    console.log("=".repeat(80) + "\n");

    if (result.output) {
      console.log("📊 RESULTS:");
      console.log("-".repeat(80));
      console.log(`🎯 Strategy: ${result.output.strategy}`);
      console.log(`� Soummary: ${result.output.summary}`);
      console.log(`✅ Status: ${result.output.completionStatus.toUpperCase()}`);
      console.log(`📰 Total Items: ${result.output.totalItems}`);
      
      if (result.output.pagesVisited) {
        console.log(`📄 Pages Visited: ${result.output.pagesVisited}/${maxPages}`);
        console.log(`📈 Average per page: ${Math.round(result.output.totalItems / result.output.pagesVisited)}`);
      }
      
      if (result.output.paginationMethod) {
        console.log(`🔄 Pagination Method: ${result.output.paginationMethod}`);
      }
      
      console.log("\n🎯 Extracted Data (first 20):");
      console.log("-".repeat(80));
      
      // Handle both array and object formats
      const dataArray = Array.isArray(result.output.data) 
        ? result.output.data 
        : Object.values(result.output.data)[0] || [];
      
      dataArray.slice(0, 20).forEach((item, i) => {
        console.log(`\n${i + 1}.`);
        Object.entries(item).slice(0, 4).forEach(([key, value]) => {
          const displayValue = typeof value === 'string' && value.length > 60 
            ? value.substring(0, 60) + "..." 
            : value;
          console.log(`   ${key}: ${displayValue}`);
        });
      });

      if (dataArray.length > 20) {
        console.log(`\n... and ${dataArray.length - 20} more items`);
      }

      // Show last few items if pagination was used
      if (maxPages > 1 && dataArray.length > 20) {
        console.log("\n🎯 Last 5 items (from final page):");
        console.log("-".repeat(80));
        dataArray.slice(-5).forEach((item, i) => {
          console.log(`\n${dataArray.length - 4 + i}.`);
          Object.entries(item).slice(0, 3).forEach(([key, value]) => {
            const displayValue = typeof value === 'string' && value.length > 60 
              ? value.substring(0, 60) + "..." 
              : value;
            console.log(`   ${key}: ${displayValue}`);
          });
        });
      }

      // Save results automatically
      const fs = await import('fs/promises');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `interactive-scraping-${timestamp}.json`;
      
      const output = {
        task: userTask,
        url: targetUrl,
        timestamp: new Date().toISOString(),
        maxPages: maxPages,
        maxSteps: maxSteps,
        model: "Azure OpenAI GPT-4o mini",
        result: result.output,
        agentReasoning: result.messages,
      };
      
      await fs.writeFile(filename, JSON.stringify(output, null, 2));
      console.log(`\n💾 Results saved to: ${filename}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("🎉 Interactive scraping completed!");
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
