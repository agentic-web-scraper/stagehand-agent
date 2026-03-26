'use strict';

import { Stagehand, CustomOpenAIClient } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

// Wrapper to clean NVIDIA NIM responses for extract/observe/act
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

console.log("🤖 Hybrid Agent - Azure + NVIDIA NIM");
console.log("=" + "=".repeat(79));
console.log("☁️  Agent mode: Azure OpenAI (GPT-4o mini)");
console.log("⚡ Extract/Observe/Act: NVIDIA NIM (cost-effective)");
console.log("=" + "=".repeat(79) + "\n");

const userPrompt = process.argv[2];
const targetUrl = process.argv[3];
const maxSteps = parseInt(process.argv[4]) || 30;

if (!userPrompt || !targetUrl) {
  console.log("❌ Usage: node tests/agentic/azure_hybrid_scraper.js \"<task>\" \"<url>\" [maxSteps]\n");
  console.log("📝 Examples:");
  console.log('  node tests/agentic/azure_hybrid_scraper.js "Scrape 50 stories" "https://news.ycombinator.com"');
  console.log('  node tests/agentic/azure_hybrid_scraper.js "Get products under $100" "https://example.com/shop"');
  process.exit(1);
}

console.log(`💬 Task: "${userPrompt}"`);
console.log(`🌐 URL: ${targetUrl}`);
console.log(`🎯 Max steps: ${maxSteps}\n`);

(async () => {
  let stagehand;

  try {
    console.log("🚀 Initializing hybrid agent...");
    
    // Use NVIDIA NIM for basic operations (extract, observe, act)
    const nvidiaClient = new CleanedNvidiaClient({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: process.env.NVIDIA_BASE_URL,
    });

    stagehand = new Stagehand({
      env: "LOCAL",
      localBrowserLaunchOptions: {
        headless: false,
        viewport: { width: 1280, height: 720 },
      },
      llmClient: new CustomOpenAIClient({
        modelName: "meta/llama-3.1-8b-instruct",
        client: nvidiaClient,
      }),
      verbose: 2,
      experimental: true,
      disableAPI: true,
    });

    await stagehand.init();
    console.log("✅ Stagehand initialized with NVIDIA NIM for basic ops");
    console.log("✅ Azure OpenAI ready for agent mode\n");
    
    const page = stagehand.context.pages()[0];
    
    console.log("🌐 Navigating to target...");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ Page loaded\n");

    console.log("=" + "=".repeat(79));
    console.log("🧠 HYBRID AGENT STARTING");
    console.log("=" + "=".repeat(79) + "\n");

    // Create agent with Azure OpenAI (for autonomous multi-step reasoning)
    const agent = stagehand.agent({
      model: {
        modelName: "gpt-4o-mini",
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        baseURL: process.env.AZURE_OPENAI_ENDPOINT,
      },
      systemPrompt: `You are an expert web scraping agent. Your capabilities:

1. OBSERVE: Analyze webpage structure and identify data patterns
2. PLAN: Create a step-by-step strategy for data extraction
3. EXTRACT: Pull structured data from pages
4. NAVIGATE: Find and use pagination controls
5. ADAPT: Adjust your approach based on what you discover

IMPORTANT:
- Think step-by-step and explain your reasoning
- When you see pagination (More, Next, page numbers), navigate through multiple pages
- Extract ALL requested data, not just from the first page
- Be thorough and systematic
- Summarize what you accomplished

Your task: ${userPrompt}`,
      mode: "dom",
    });

    // Define output schema
    const OutputSchema = z.object({
      data: z.array(z.record(z.string(), z.any())).describe("Array of extracted items"),
      totalItems: z.number().describe("Total number of items extracted"),
      pagesVisited: z.number().optional().describe("Number of pages visited"),
      strategy: z.string().describe("Extraction strategy used"),
      summary: z.string().describe("Summary of accomplishments"),
      completionStatus: z.enum(["complete", "partial", "failed"]).describe("Task completion status"),
    });

    console.log("🎯 Agent executing task...\n");
    console.log("💭 Hybrid approach:");
    console.log("   • Azure OpenAI: High-level planning and reasoning");
    console.log("   • NVIDIA NIM: Fast extraction and interaction");
    console.log("   • Best of both worlds: Quality + Cost efficiency\n");
    console.log("-".repeat(80) + "\n");
    
    // Execute autonomous task
    const result = await agent.execute({
      instruction: userPrompt,
      maxSteps: maxSteps,
      output: OutputSchema,
      highlightCursor: true,
    });

    console.log("\n" + "=".repeat(80));
    console.log("✅ HYBRID AGENT COMPLETED");
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
        console.log("\n🧠 Agent's Reasoning Steps:");
        console.log("-".repeat(80));
        let stepNum = 1;
        result.messages.forEach((msg) => {
          if (msg.role === 'assistant' && msg.content) {
            const preview = msg.content.substring(0, 150);
            console.log(`\nStep ${stepNum}: ${preview}${msg.content.length > 150 ? '...' : ''}`);
            stepNum++;
          }
        });
      }

      // Save results
      const fs = await import('fs/promises');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `hybrid-agent-results-${timestamp}.json`;
      
      const output = {
        task: userPrompt,
        url: targetUrl,
        timestamp: new Date().toISOString(),
        maxSteps: maxSteps,
        agentModel: "Azure OpenAI GPT-4o mini",
        extractModel: "NVIDIA NIM Llama 3.1 8B",
        result: result.output,
        agentReasoning: result.messages,
      };
      
      await fs.writeFile(filename, JSON.stringify(output, null, 2));
      console.log(`\n💾 Full results saved to: ${filename}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("🎉 Hybrid agent scraping completed!");
    console.log("💡 Cost optimization: Azure for planning, NVIDIA for execution");
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
