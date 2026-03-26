'use strict';

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';

dotenv.config();

console.log("🤖 Azure OpenAI Pagination Agent");
console.log("=" + "=".repeat(79));
console.log("☁️  Powered by Azure OpenAI (GPT-4o mini)");
console.log("📄 Multi-page scraping with autonomous navigation");
console.log("=" + "=".repeat(79) + "\n");

const userPrompt = process.argv[2];
const targetUrl = process.argv[3];
const maxPages = parseInt(process.argv[4]) || 3;
const maxSteps = parseInt(process.argv[5]) || 50;

if (!userPrompt || !targetUrl) {
  console.log("❌ Usage: node tests/agentic/azure_pagination_agent.js \"<task>\" \"<url>\" [maxPages] [maxSteps]\n");
  console.log("📝 Examples:");
  console.log('  node tests/agentic/azure_pagination_agent.js "Scrape 50 stories" "https://news.ycombinator.com" 3');
  console.log('  node tests/agentic/azure_pagination_agent.js "Get all products" "https://example.com/shop" 5');
  process.exit(1);
}

console.log(`💬 Task: "${userPrompt}"`);
console.log(`🌐 URL: ${targetUrl}`);
console.log(`📄 Max pages: ${maxPages}`);
console.log(`🎯 Max steps: ${maxSteps}\n`);

(async () => {
  let stagehand;

  try {
    console.log("🚀 Initializing Stagehand with Azure OpenAI...");
    
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
    console.log("🧠 PAGINATION AGENT STARTING");
    console.log("=" + "=".repeat(79) + "\n");

    // Create agent with Azure OpenAI
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",
      systemPrompt: `You are an expert web scraping agent specialized in multi-page data extraction.

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

IMPORTANT:
- You MUST navigate through multiple pages (up to ${maxPages} pages)
- Extract data from EACH page before moving to the next
- Count pages visited accurately
- If pagination stops working, report how many pages you successfully scraped

CURRENT TASK: ${userPrompt}

Remember: Visit multiple pages and collect comprehensive data!`,
      mode: "dom",
    });

    // Define output schema for pagination
    const OutputSchema = z.object({
      data: z.array(z.record(z.string(), z.any())).describe("Array of all extracted items from all pages"),
      totalItems: z.number().describe("Total number of items extracted across all pages"),
      pagesVisited: z.number().describe("Number of pages successfully visited and scraped"),
      strategy: z.string().describe("Explanation of the pagination strategy used"),
      summary: z.string().describe("Summary of what was accomplished, including pagination details"),
      completionStatus: z.enum(["complete", "partial", "failed"]).describe("Status of task completion"),
      paginationMethod: z.string().optional().describe("How pagination was handled (e.g., 'More link', 'Next button', 'Page numbers')"),
    });

    console.log("🎯 Agent executing pagination task...\n");
    console.log("💭 The agent will:");
    console.log("   • Extract data from page 1");
    console.log("   • Find pagination controls");
    console.log("   • Navigate to next page");
    console.log("   • Extract data from page 2");
    console.log("   • Continue until max pages reached");
    console.log(`   • Target: ${maxPages} pages\n`);
    console.log("-".repeat(80) + "\n");
    
    // Execute autonomous pagination task
    const result = await agent.execute({
      instruction: `${userPrompt}. You MUST navigate through multiple pages (up to ${maxPages} pages) and collect data from each page. Use pagination controls like "More", "Next", or page numbers to navigate.`,
      maxSteps: maxSteps,
      output: OutputSchema,
      highlightCursor: true,
    });

    console.log("\n" + "=".repeat(80));
    console.log("✅ PAGINATION AGENT COMPLETED");
    console.log("=".repeat(80) + "\n");

    if (result.output) {
      console.log("📊 PAGINATION RESULTS:");
      console.log("-".repeat(80));
      console.log(`🎯 Strategy: ${result.output.strategy}`);
      console.log(`📝 Summary: ${result.output.summary}`);
      console.log(`✅ Status: ${result.output.completionStatus.toUpperCase()}`);
      console.log(`📄 Pages Visited: ${result.output.pagesVisited}/${maxPages}`);
      console.log(`📰 Total Items: ${result.output.totalItems}`);
      console.log(`📈 Average per page: ${Math.round(result.output.totalItems / result.output.pagesVisited)}`);
      if (result.output.paginationMethod) {
        console.log(`🔄 Pagination Method: ${result.output.paginationMethod}`);
      }
      
      console.log("\n🎯 Extracted Data (first 15):");
      console.log("-".repeat(80));
      
      // Handle both array and object formats
      const dataArray = Array.isArray(result.output.data) 
        ? result.output.data 
        : result.output.data?.stories || [];
      
      dataArray.slice(0, 15).forEach((item, i) => {
        console.log(`\n${i + 1}.`);
        Object.entries(item).slice(0, 3).forEach(([key, value]) => {
          const displayValue = typeof value === 'string' && value.length > 60 
            ? value.substring(0, 60) + "..." 
            : value;
          console.log(`   ${key}: ${displayValue}`);
        });
      });

      if (dataArray.length > 15) {
        console.log(`\n... and ${dataArray.length - 15} more items`);
      }

      // Show last 5 items to prove pagination worked
      if (dataArray.length > 15) {
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

      // Show agent's reasoning
      if (result.messages && result.messages.length > 0) {
        console.log("\n🧠 Agent's Pagination Steps:");
        console.log("-".repeat(80));
        let stepNum = 1;
        result.messages.forEach((msg) => {
          if (msg.role === 'assistant' && msg.content) {
            const contentStr = typeof msg.content === 'string' 
              ? msg.content 
              : JSON.stringify(msg.content);
            const preview = contentStr.substring(0, 150);
            console.log(`\nStep ${stepNum}: ${preview}${contentStr.length > 150 ? '...' : ''}`);
            stepNum++;
          }
        });
      }

      // Save results
      const fs = await import('fs/promises');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `azure-pagination-results-${timestamp}.json`;
      
      const output = {
        task: userPrompt,
        url: targetUrl,
        timestamp: new Date().toISOString(),
        maxPages: maxPages,
        maxSteps: maxSteps,
        model: "Azure OpenAI GPT-4o mini",
        result: result.output,
        agentReasoning: result.messages,
      };
      
      await fs.writeFile(filename, JSON.stringify(output, null, 2));
      console.log(`\n💾 Full results with pagination history saved to: ${filename}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("🎉 Azure OpenAI pagination agent completed!");
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
