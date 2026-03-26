'use strict';

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';

dotenv.config();

console.log("🤖 Azure OpenAI Agent - Web Scraper");
console.log("=" + "=".repeat(79));
console.log("☁️  Powered by Azure OpenAI (GPT-4o mini)");
console.log("🧠 True agentic behavior: Planning → Reasoning → Acting");
console.log("=" + "=".repeat(79) + "\n");

const userPrompt = process.argv[2];
const targetUrl = process.argv[3];
const maxSteps = parseInt(process.argv[4]) || 30;

if (!userPrompt || !targetUrl) {
  console.log("❌ Usage: node tests/agentic/azure_agent_scraper.js \"<task>\" \"<url>\" [maxSteps]\n");
  console.log("📝 Examples:");
  console.log('  node tests/agentic/azure_agent_scraper.js "Scrape top 20 stories with titles and points" "https://news.ycombinator.com"');
  console.log('  node tests/agentic/azure_agent_scraper.js "Find products under $50" "https://example.com/shop"');
  console.log('  node tests/agentic/azure_agent_scraper.js "Get articles from first 3 pages" "https://blog.example.com"');
  process.exit(1);
}

console.log(`💬 Task: "${userPrompt}"`);
console.log(`🌐 URL: ${targetUrl}`);
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
      model: "azure/gpt-4o-mini",  // Use Azure provider format
      verbose: 2,  // Show agent thinking and planning
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
    console.log("🧠 AGENT STARTING - Autonomous Mode");
    console.log("=" + "=".repeat(79) + "\n");

    // Create agent with Azure OpenAI
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",  // Use Azure provider format
      systemPrompt: `You are an expert web scraping agent with advanced capabilities:

CORE ABILITIES:
1. OBSERVE: Analyze webpage structure and identify data patterns
2. PLAN: Create systematic step-by-step extraction strategies
3. EXTRACT: Pull structured data with precision
4. NAVIGATE: Find and use pagination controls intelligently
5. ADAPT: Adjust your approach based on discoveries

INSTRUCTIONS:
- Think step-by-step and explain your reasoning clearly
- When you encounter pagination (More, Next, page numbers), navigate through multiple pages
- Extract ALL requested data, not just from the first page
- Be thorough, systematic, and efficient
- Handle errors gracefully and adapt your strategy
- Provide clear summaries of your accomplishments

CURRENT TASK: ${userPrompt}

Remember: Quality and completeness matter. Take your time to do it right.`,
      mode: "dom",
    });

    // Define comprehensive output schema
    const OutputSchema = z.object({
      data: z.array(z.record(z.string(), z.any())).describe("Array of extracted items with their properties"),
      totalItems: z.number().describe("Total number of items successfully extracted"),
      pagesVisited: z.number().optional().describe("Number of pages navigated and scraped"),
      strategy: z.string().describe("Brief explanation of the extraction strategy you used"),
      summary: z.string().describe("Summary of what was accomplished and any challenges encountered"),
      completionStatus: z.enum(["complete", "partial", "failed"]).describe("Status of task completion"),
    });

    console.log("🎯 Agent is now autonomous...\n");
    console.log("💭 The agent will:");
    console.log("   • Analyze the page structure");
    console.log("   • Plan the extraction strategy");
    console.log("   • Execute step-by-step");
    console.log("   • Navigate pagination if found");
    console.log("   • Adapt based on observations");
    console.log("   • Provide detailed results\n");
    console.log("-".repeat(80) + "\n");
    
    // Execute autonomous task
    const result = await agent.execute({
      instruction: userPrompt,
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
      console.log(`📝 Summary: ${result.output.summary}`);
      console.log(`✅ Status: ${result.output.completionStatus.toUpperCase()}`);
      console.log(`📰 Total Items: ${result.output.totalItems}`);
      if (result.output.pagesVisited) {
        console.log(`📄 Pages Visited: ${result.output.pagesVisited}`);
      }
      
      console.log("\n🎯 Extracted Data (first 10):");
      console.log("-".repeat(80));
      
      // Handle both array and object formats
      const dataArray = Array.isArray(result.output.data) 
        ? result.output.data 
        : result.output.data?.stories || [];
      
      dataArray.slice(0, 10).forEach((item, i) => {
        console.log(`\n${i + 1}.`);
        Object.entries(item).forEach(([key, value]) => {
          const displayValue = typeof value === 'string' && value.length > 70 
            ? value.substring(0, 70) + "..." 
            : value;
          console.log(`   ${key}: ${displayValue}`);
        });
      });

      if (dataArray.length > 10) {
        console.log(`\n... and ${dataArray.length - 10} more items`);
      }

      // Show agent's reasoning steps
      if (result.messages && result.messages.length > 0) {
        console.log("\n🧠 Agent's Reasoning Process:");
        console.log("-".repeat(80));
        let stepNum = 1;
        result.messages.forEach((msg) => {
          if (msg.role === 'assistant' && msg.content) {
            // Handle both string and array content
            const contentStr = typeof msg.content === 'string' 
              ? msg.content 
              : JSON.stringify(msg.content);
            const preview = contentStr.substring(0, 200);
            console.log(`\nStep ${stepNum}: ${preview}${contentStr.length > 200 ? '...' : ''}`);
            stepNum++;
          }
        });
      }

      // Save results
      const fs = await import('fs/promises');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `azure-agent-results-${timestamp}.json`;
      
      const output = {
        task: userPrompt,
        url: targetUrl,
        timestamp: new Date().toISOString(),
        maxSteps: maxSteps,
        model: "Azure OpenAI GPT-4o mini",
        result: result.output,
        agentReasoning: result.messages,
      };
      
      await fs.writeFile(filename, JSON.stringify(output, null, 2));
      console.log(`\n💾 Full results with agent reasoning saved to: ${filename}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("🎉 Azure OpenAI agent scraping completed!");
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
