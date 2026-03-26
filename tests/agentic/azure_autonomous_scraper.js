'use strict';

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

console.log("🤖 Azure OpenAI Autonomous Web Scraper");
console.log("=" + "=".repeat(79));
console.log("☁️  Powered by Azure OpenAI (GPT-4o mini)");
console.log("🌐 Just tell me what you want - I'll find and scrape it!");
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
    // Get task from user - no URL needed!
    const userTask = await question("💬 What do you want to scrape?\n   (e.g., 'Find and scrape the top 10 Python tutorials', 'Get latest iPhone prices from Apple')\n   → ");
    
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
    const maxSteps = parseInt(await question("\n🎯 Max steps for agent? (default 100 for search + scrape): ") || "100");

    console.log("\n" + "=".repeat(80));
    console.log("📋 TASK SUMMARY");
    console.log("=".repeat(80));
    console.log(`💬 Task: ${userTask}`);
    console.log(`📄 Pages: ${maxPages}`);
    console.log(`🎯 Max steps: ${maxSteps}`);
    console.log("=".repeat(80) + "\n");

    const confirm = await question("▶️  Start autonomous scraping? (yes/no): ");
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
    
    // Start from Google
    console.log("🌐 Starting from Google...");
    await page.goto('https://www.google.com', { waitUntil: "domcontentloaded" });
    console.log("✅ Ready to search\n");

    console.log("=" + "=".repeat(79));
    console.log("🧠 AUTONOMOUS AGENT STARTING");
    console.log("=" + "=".repeat(79) + "\n");

    // Build comprehensive system prompt
    const systemPrompt = `You are an expert autonomous web scraping agent with full web navigation capabilities.

CORE ABILITIES:
1. SEARCH: Use Google to find the right website for the task
2. NAVIGATE: Click on search results and navigate to the target website
3. OBSERVE: Analyze webpage structure and identify data patterns
4. EXTRACT: Pull structured data with precision
${maxPages > 1 ? `5. PAGINATE: Navigate through multiple pages (up to ${maxPages} pages) using pagination controls` : ''}
6. ADAPT: Adjust your approach based on what you discover

WORKFLOW:
1. First, use Google search to find the best website for the task
2. Click on the most relevant search result
3. Once on the target website, analyze the page structure
4. Extract the requested data
${maxPages > 1 ? `5. If pagination is needed, find and click pagination controls (More, Next, page numbers)
6. Continue extracting from additional pages until you reach ${maxPages} pages or no more pagination exists` : ''}

SEARCH STRATEGY:
- Formulate a good search query based on the user's request
- Look for official websites, popular platforms, or authoritative sources
- Click on the most relevant result (usually top 3 results)
- If the first result doesn't have the data, try another result

CURRENT TASK: ${userTask}

Remember: You start at Google. Search first, then navigate to the right site, then scrape!`;

    // Create agent with Azure OpenAI
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",
      systemPrompt: systemPrompt,
      mode: "dom",
    });

    // Define flexible output schema
    const OutputSchema = z.object({
      searchQuery: z.string().describe("The search query you used to find the website"),
      targetWebsite: z.string().describe("The website URL you navigated to for scraping"),
      data: z.array(z.record(z.string(), z.any())).describe("Array of all extracted items"),
      totalItems: z.number().describe("Total number of items extracted"),
      pagesVisited: z.number().optional().describe("Number of pages visited (if pagination was used)"),
      strategy: z.string().describe("Explanation of your search and extraction strategy"),
      summary: z.string().describe("Summary of what was accomplished"),
      completionStatus: z.enum(["complete", "partial", "failed"]).describe("Status of task completion"),
      challenges: z.string().optional().describe("Any challenges encountered during the process"),
    });

    console.log("🎯 Agent executing autonomous task...\n");
    console.log("💭 The agent will:");
    console.log("   • Search Google for the right website");
    console.log("   • Navigate to the most relevant result");
    console.log("   • Analyze the page structure");
    console.log("   • Extract the requested data");
    if (maxPages > 1) {
      console.log(`   • Navigate through up to ${maxPages} pages if needed`);
    }
    console.log("\n" + "-".repeat(80) + "\n");
    
    // Execute fully autonomous task
    const instruction = maxPages > 1
      ? `${userTask}. Start by searching Google to find the right website. Then navigate to it and extract the data. If pagination is needed, navigate through up to ${maxPages} pages.`
      : `${userTask}. Start by searching Google to find the right website. Then navigate to it and extract the data.`;

    const result = await agent.execute({
      instruction: instruction,
      maxSteps: maxSteps,
      output: OutputSchema,
      highlightCursor: true,
    });

    console.log("\n" + "=".repeat(80));
    console.log("✅ AUTONOMOUS AGENT COMPLETED");
    console.log("=".repeat(80) + "\n");

    if (result.output) {
      console.log("📊 RESULTS:");
      console.log("-".repeat(80));
      console.log(`🔍 Search Query: "${result.output.searchQuery}"`);
      console.log(`🌐 Target Website: ${result.output.targetWebsite}`);
      console.log(`🎯 Strategy: ${result.output.strategy}`);
      console.log(`📝 Summary: ${result.output.summary}`);
      console.log(`✅ Status: ${result.output.completionStatus.toUpperCase()}`);
      console.log(`📰 Total Items: ${result.output.totalItems}`);
      
      if (result.output.pagesVisited) {
        console.log(`📄 Pages Visited: ${result.output.pagesVisited}/${maxPages}`);
        console.log(`📈 Average per page: ${Math.round(result.output.totalItems / result.output.pagesVisited)}`);
      }
      
      if (result.output.challenges) {
        console.log(`⚠️  Challenges: ${result.output.challenges}`);
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
      const filename = `autonomous-scraping-${timestamp}.json`;
      
      const output = {
        task: userTask,
        searchQuery: result.output.searchQuery,
        targetWebsite: result.output.targetWebsite,
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
    console.log("🎉 Autonomous scraping completed!");
    console.log("💡 The agent searched the web, found the right site, and scraped the data!");
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
