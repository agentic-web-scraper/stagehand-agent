'use strict';

import { Stagehand, CustomOpenAIClient } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
process.env.OPENAI_API_KEY = process.env.NVIDIA_API_KEY;

// Wrapper to clean NVIDIA NIM responses
class CleanedNvidiaClient {
  constructor(config) {
    this.client = new OpenAI(config);
  }

  get chat() {
    const originalChat = this.client.chat;
    return {
      completions: {
        create: async (params) => {
          const response = await originalChat.completions.create(params);
          
          if (response.choices?.[0]?.message?.content) {
            let content = response.choices[0].message.content;
            const jsonMatches = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
            if (jsonMatches && jsonMatches.length > 1) {
              content = jsonMatches[jsonMatches.length - 1];
              response.choices[0].message.content = content;
            }
          }
          
          return response;
        }
      }
    };
  }
}

const openaiClient = new CleanedNvidiaClient({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_BASE_URL,
});

const stagehandopts = {
  env: "LOCAL",
  localBrowserLaunchOptions: {
    headless: false,
    viewport: { width: 1280, height: 720 },
  },
  llmClient: new CustomOpenAIClient({
    modelName: "meta/llama-3.1-8b-instruct",
    client: openaiClient,
  }),
  verbose: 0,
};

console.log("🧠 Reasoning Agent - Autonomous Web Scraper");
console.log("=" + "=".repeat(79));
console.log("🤖 Agent with planning, reasoning, and decision-making");
console.log("💭 Powered by NVIDIA NIM");
console.log("=" + "=".repeat(79) + "\n");

const userTask = process.argv[2];
const targetUrl = process.argv[3];
const maxIterations = parseInt(process.argv[4]) || 10;

if (!userTask || !targetUrl) {
  console.log("❌ Usage: node tests/reasoning_agent_scraper.js \"<task>\" \"<url>\" [maxIterations]\n");
  console.log("📝 Examples:");
  console.log('  node tests/reasoning_agent_scraper.js "Get 30 stories with titles and points" "https://news.ycombinator.com"');
  console.log('  node tests/reasoning_agent_scraper.js "Find all products under $100" "https://example.com/shop"');
  process.exit(1);
}

console.log(`💬 Task: "${userTask}"`);
console.log(`🌐 URL: ${targetUrl}`);
console.log(`🔄 Max iterations: ${maxIterations}\n`);

// Reasoning Agent Class
class ReasoningAgent {
  constructor(stagehand, llmClient, task) {
    this.stagehand = stagehand;
    this.llmClient = llmClient;
    this.task = task;
    this.memory = [];
    this.collectedData = [];
    this.currentPage = 1;
  }

  async think(observation) {
    // Agent thinks about what to do next
    const prompt = `You are an autonomous web scraping agent. 

TASK: ${this.task}

CURRENT STATE:
- Page: ${this.currentPage}
- Items collected so far: ${this.collectedData.length}
- Observation: ${observation}

MEMORY (previous actions):
${this.memory.slice(-3).map((m, i) => `${i + 1}. ${m}`).join('\n')}

Based on the current state, decide what to do next. Your options:
1. EXTRACT - Extract data from the current page
2. NAVIGATE - Navigate to the next page (if pagination exists)
3. COMPLETE - Task is complete, stop

Respond ONLY with a valid JSON object (no extra text):
{
  "reasoning": "explain your thinking process",
  "action": "EXTRACT" | "NAVIGATE" | "COMPLETE",
  "confidence": 0-100,
  "details": "any additional details"
}`;

    try {
      const response = await this.llmClient.chat.completions.create({
        model: "meta/llama-3.1-8b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      let content = response.choices[0].message.content;
      
      // Clean response (remove schema if present)
      const jsonMatches = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      if (jsonMatches && jsonMatches.length > 1) {
        content = jsonMatches[jsonMatches.length - 1];
      }
      
      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log(`  ⚠️  Thinking error, using default action`);
    }
    
    // Fallback decision
    if (this.collectedData.length === 0) {
      return {
        reasoning: "No data collected yet, starting extraction",
        action: "EXTRACT",
        confidence: 80,
        details: "Initial extraction"
      };
    } else if (this.collectedData.length < 30) {
      return {
        reasoning: "Need more data, trying navigation",
        action: "NAVIGATE",
        confidence: 70,
        details: "Looking for more pages"
      };
    } else {
      return {
        reasoning: "Sufficient data collected",
        action: "COMPLETE",
        confidence: 90,
        details: "Task complete"
      };
    }
  }

  async observe() {
    // Observe the current page state (lightweight check)
    try {
      const page = this.stagehand.context.pages()[0];
      
      // Quick check for pagination using Playwright
      const moreLink = await page.locator('a:has-text("More"), a:has-text("Next"), a.morelink').count();
      const hasPagination = moreLink > 0;
      
      return {
        elementsFound: this.collectedData.length,
        hasPagination,
        summary: `Collected ${this.collectedData.length} items, pagination: ${hasPagination ? 'yes' : 'no'}`
      };
    } catch (error) {
      return {
        elementsFound: this.collectedData.length,
        hasPagination: false,
        summary: `Collected ${this.collectedData.length} items`
      };
    }
  }

  async extract() {
    // Extract data from current page with retry
    console.log(`  🤖 Extracting data...`);
    
    const ContentSchema = z.object({
      items: z.array(z.record(z.string(), z.any())).describe("Extracted items"),
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await this.stagehand.extract(
          `Extract data for: ${this.task}`,
          ContentSchema
        );

        this.collectedData = this.collectedData.concat(result.items);
        console.log(`  ✅ Extracted ${result.items.length} items (Total: ${this.collectedData.length})`);
        
        return { success: true, count: result.items.length };
      } catch (error) {
        if (attempt < 3 && error.message.includes('Failed to parse model response as JSON')) {
          console.log(`  ⚠️  JSON parse error, retrying (${attempt}/3)...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        console.log(`  ❌ Extraction failed: ${error.message.substring(0, 60)}`);
        return { success: false, count: 0 };
      }
    }
    
    return { success: false, count: 0 };
  }

  async navigate() {
    // Navigate to next page
    console.log(`  🔄 Navigating to next page...`);
    
    try {
      const nextActions = await this.stagehand.observe("find next page, more link, or pagination control");
      
      if (nextActions.length > 0) {
        await this.stagehand.act(nextActions[0]);
        const page = this.stagehand.context.pages()[0];
        await page.waitForLoadState("domcontentloaded");
        await new Promise(r => setTimeout(r, 1500));
        
        this.currentPage++;
        console.log(`  ✅ Navigated to page ${this.currentPage}`);
        return { success: true };
      } else {
        console.log(`  ⚠️  No pagination found`);
        return { success: false };
      }
    } catch (error) {
      console.log(`  ❌ Navigation failed: ${error.message.substring(0, 60)}`);
      return { success: false };
    }
  }

  async run() {
    console.log("=" + "=".repeat(79));
    console.log("🧠 REASONING AGENT STARTING");
    console.log("=" + "=".repeat(79) + "\n");

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      console.log(`\n🔄 Iteration ${iteration}/${maxIterations}`);
      console.log("-".repeat(80));

      // Step 1: Observe
      console.log(`  👁️  Observing page state...`);
      const observation = await this.observe();
      console.log(`  📊 ${observation.summary}`);

      // Step 2: Think (reason about what to do)
      console.log(`  💭 Thinking...`);
      const decision = await this.think(observation.summary);
      console.log(`  🧠 Reasoning: ${decision.reasoning}`);
      console.log(`  🎯 Decision: ${decision.action} (confidence: ${decision.confidence}%)`);

      // Step 3: Act based on decision
      let actionResult;
      
      if (decision.action === "EXTRACT") {
        actionResult = await this.extract();
        this.memory.push(`Iteration ${iteration}: Extracted data from page ${this.currentPage}`);
        
      } else if (decision.action === "NAVIGATE") {
        actionResult = await this.navigate();
        this.memory.push(`Iteration ${iteration}: Navigated to page ${this.currentPage}`);
        
        if (!actionResult.success) {
          console.log(`  💭 Navigation failed, trying extraction instead...`);
          actionResult = await this.extract();
        }
        
      } else if (decision.action === "COMPLETE") {
        console.log(`  ✅ Agent decided task is complete`);
        break;
      }

      // Check if we should continue
      if (decision.action === "EXTRACT" && !actionResult.success) {
        console.log(`  ⚠️  Extraction failed, stopping`);
        break;
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ REASONING AGENT COMPLETED");
    console.log("=".repeat(80));

    return {
      totalItems: this.collectedData.length,
      pagesVisited: this.currentPage,
      data: this.collectedData,
      memory: this.memory,
    };
  }
}

// Main execution
(async () => {
  let stagehand;

  try {
    console.log("🚀 Initializing...");
    stagehand = new Stagehand(stagehandopts);
    await stagehand.init();
    console.log("✅ Stagehand ready\n");
    
    const page = stagehand.context.pages()[0];
    
    console.log("🌐 Navigating to target...");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ Page loaded\n");

    // Create and run reasoning agent
    const agent = new ReasoningAgent(stagehand, openaiClient, userTask);
    const result = await agent.run();

    // Display results
    console.log("\n📊 FINAL RESULTS:");
    console.log("-".repeat(80));
    console.log(`📰 Total Items: ${result.totalItems}`);
    console.log(`📄 Pages Visited: ${result.pagesVisited}`);
    console.log(`🧠 Actions Taken: ${result.memory.length}`);

    console.log("\n🎯 Sample Data (first 5):");
    result.data.slice(0, 5).forEach((item, i) => {
      console.log(`\n${i + 1}.`);
      Object.entries(item).forEach(([k, v]) => {
        const display = String(v).substring(0, 60);
        console.log(`   ${k}: ${display}${String(v).length > 60 ? '...' : ''}`);
      });
    });

    console.log("\n🧠 Agent's Memory:");
    result.memory.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m}`);
    });

    // Save results
    const fs = await import('fs/promises');
    const filename = `reasoning-agent-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify({
      task: userTask,
      url: targetUrl,
      timestamp: new Date().toISOString(),
      result
    }, null, 2));
    console.log(`\n💾 Saved to: ${filename}`);

    console.log("\n" + "=".repeat(80));
    console.log("🎉 Mission accomplished!");
    console.log("=".repeat(80));

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    if (stagehand) await stagehand.close();
  }
})();
