'use strict';

import { Stagehand, CustomOpenAIClient } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
process.env.OPENAI_API_KEY = process.env.NVIDIA_API_KEY;

// Enhanced wrapper with better JSON cleaning
class CleanedNvidiaClient {
  constructor(config) {
    this.client = new OpenAI(config);
  }

  _extractJSON(content) {
    // Try multiple strategies to extract valid JSON
    
    // Strategy 1: Find last complete JSON object
    const jsonMatches = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
    if (jsonMatches && jsonMatches.length > 0) {
      // Return the last one (usually the actual data, not schema)
      return jsonMatches[jsonMatches.length - 1];
    }
    
    // Strategy 2: Look for JSON between markers
    const betweenBraces = content.match(/\{[\s\S]*\}/);
    if (betweenBraces) {
      return betweenBraces[0];
    }
    
    return content;
  }

  get chat() {
    const self = this;
    const originalChat = this.client.chat;
    
    return {
      completions: {
        create: async (params) => {
          const response = await originalChat.completions.create(params);
          
          if (response.choices?.[0]?.message?.content) {
            const cleaned = self._extractJSON(response.choices[0].message.content);
            response.choices[0].message.content = cleaned;
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

console.log("🧠 Final Reasoning Agent - Autonomous Web Scraper");
console.log("=" + "=".repeat(79));
console.log("🤖 True agentic behavior: Planning → Reasoning → Acting");
console.log("💭 Powered by NVIDIA NIM (meta/llama-3.1-8b-instruct)");
console.log("=" + "=".repeat(79) + "\n");

const userTask = process.argv[2];
const targetUrl = process.argv[3];
const maxIterations = parseInt(process.argv[4]) || 8;

if (!userTask || !targetUrl) {
  console.log("❌ Usage: node tests/final_reasoning_agent.js \"<task>\" \"<url>\" [iterations]\n");
  console.log("📝 Examples:");
  console.log('  node tests/final_reasoning_agent.js "Get 50 stories" "https://news.ycombinator.com"');
  console.log('  node tests/final_reasoning_agent.js "Find products under $100" "https://shop.example.com"');
  process.exit(1);
}

console.log(`💬 Task: "${userTask}"`);
console.log(`🌐 URL: ${targetUrl}`);
console.log(`🔄 Max iterations: ${maxIterations}\n`);

// Simplified Reasoning Agent
class ReasoningAgent {
  constructor(stagehand, llmClient, task) {
    this.stagehand = stagehand;
    this.llmClient = llmClient;
    this.task = task;
    this.collectedData = [];
    this.currentPage = 1;
    this.actions = [];
  }

  async think() {
    // Simple reasoning: decide next action
    const prompt = `Task: ${this.task}
Current: Page ${this.currentPage}, collected ${this.collectedData.length} items

What should I do next? Reply with ONE word:
- EXTRACT (if need more data from current page)
- NAVIGATE (if should go to next page)
- DONE (if task complete)

Answer:`;

    try {
      const response = await this.llmClient.chat.completions.create({
        model: "meta/llama-3.1-8b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 50,
      });

      const decision = response.choices[0].message.content.trim().toUpperCase();
      
      if (decision.includes('EXTRACT')) return 'EXTRACT';
      if (decision.includes('NAVIGATE')) return 'NAVIGATE';
      if (decision.includes('DONE')) return 'DONE';
      
      // Default
      return this.collectedData.length === 0 ? 'EXTRACT' : 'NAVIGATE';
    } catch (error) {
      // Fallback logic
      return this.collectedData.length === 0 ? 'EXTRACT' : 'NAVIGATE';
    }
  }

  async extract() {
    console.log(`  📥 Extracting...`);
    
    const ContentSchema = z.object({
      items: z.array(z.record(z.string(), z.any())),
    });

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await this.stagehand.extract(
          this.task,
          ContentSchema
        );

        const newItems = result.items.length;
        this.collectedData = this.collectedData.concat(result.items);
        console.log(`  ✅ Got ${newItems} items (Total: ${this.collectedData.length})`);
        
        return true;
      } catch (error) {
        if (attempt < 2) {
          console.log(`  ⚠️  Retry ${attempt}/2...`);
          await new Promise(r => setTimeout(r, 1500));
        } else {
          console.log(`  ❌ Failed`);
          return false;
        }
      }
    }
    return false;
  }

  async navigate() {
    console.log(`  🔄 Navigating...`);
    
    try {
      const page = this.stagehand.context.pages()[0];
      const moreLink = page.locator('a:has-text("More"), a:has-text("Next"), a.morelink');
      const count = await moreLink.count();
      
      if (count > 0) {
        await moreLink.first().click();
        await page.waitForLoadState("domcontentloaded");
        await new Promise(r => setTimeout(r, 1000));
        
        this.currentPage++;
        console.log(`  ✅ Now on page ${this.currentPage}`);
        return true;
      } else {
        console.log(`  ⚠️  No more pages`);
        return false;
      }
    } catch (error) {
      console.log(`  ❌ Navigation failed`);
      return false;
    }
  }

  async run() {
    console.log("=" + "=".repeat(79));
    console.log("🧠 AGENT STARTING");
    console.log("=" + "=".repeat(79) + "\n");

    for (let i = 1; i <= maxIterations; i++) {
      console.log(`\n🔄 Iteration ${i}/${maxIterations}`);
      console.log("-".repeat(80));

      // Think
      console.log(`  💭 Thinking...`);
      const decision = await this.think();
      console.log(`  🎯 Decision: ${decision}`);

      this.actions.push(`Iteration ${i}: ${decision}`);

      // Act
      if (decision === 'EXTRACT') {
        const success = await this.extract();
        if (!success) break;
        
      } else if (decision === 'NAVIGATE') {
        const success = await this.navigate();
        if (!success) {
          // Try extracting instead
          console.log(`  💭 Navigation failed, trying extraction...`);
          await this.extract();
        }
        
      } else if (decision === 'DONE') {
        console.log(`  ✅ Agent decided task is complete`);
        break;
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ AGENT COMPLETED");
    console.log("=".repeat(80));

    return {
      totalItems: this.collectedData.length,
      pagesVisited: this.currentPage,
      data: this.collectedData,
      actions: this.actions,
    };
  }
}

// Main
(async () => {
  let stagehand;

  try {
    stagehand = new Stagehand(stagehandopts);
    await stagehand.init();
    
    const page = stagehand.context.pages()[0];
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ Ready\n");

    const agent = new ReasoningAgent(stagehand, openaiClient, userTask);
    const result = await agent.run();

    console.log("\n📊 RESULTS:");
    console.log("-".repeat(80));
    console.log(`📰 Items: ${result.totalItems}`);
    console.log(`📄 Pages: ${result.pagesVisited}`);
    console.log(`🧠 Actions: ${result.actions.length}`);

    console.log("\n🎯 Sample (first 5):");
    result.data.slice(0, 5).forEach((item, i) => {
      console.log(`\n${i + 1}.`);
      Object.entries(item).slice(0, 3).forEach(([k, v]) => {
        console.log(`   ${k}: ${String(v).substring(0, 50)}`);
      });
    });

    console.log("\n🧠 Actions taken:");
    result.actions.forEach(a => console.log(`  • ${a}`));

    const fs = await import('fs/promises');
    const filename = `agent-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify({ task: userTask, url: targetUrl, result }, null, 2));
    console.log(`\n💾 Saved: ${filename}`);

    console.log("\n🎉 Done!");

  } catch (error) {
    console.error("\n❌", error.message);
  } finally {
    if (stagehand) await stagehand.close();
  }
})();
