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
    viewport: {
      width: 1280,
      height: 720,
    },
  },
  llmClient: new CustomOpenAIClient({
    modelName: "meta/llama-3.1-8b-instruct",
    client: openaiClient,
  }),
  verbose: 1,  // Show agent thinking
  experimental: true,  // Enable experimental features
  disableAPI: true,    // Required for experimental features
};

console.log("🤖 Autonomous Web Scraping Agent");
console.log("=" + "=".repeat(79));
console.log("💬 Give me a prompt, I'll figure out the rest!");
console.log("=" + "=".repeat(79) + "\n");

// Get user prompt from command line
const userPrompt = process.argv[2];
const targetUrl = process.argv[3];

if (!userPrompt || !targetUrl) {
  console.log("❌ Usage: node tests/autonomous_scraper.js \"<prompt>\" \"<url>\"\n");
  console.log("📝 Examples:");
  console.log('  node tests/autonomous_scraper.js "Get the top 10 story titles" "https://news.ycombinator.com"');
  console.log('  node tests/autonomous_scraper.js "Find all product names and prices" "https://example.com/shop"');
  console.log('  node tests/autonomous_scraper.js "Scrape the first 3 pages of articles" "https://blog.example.com"');
  process.exit(1);
}

console.log(`💬 Your prompt: "${userPrompt}"`);
console.log(`🌐 Target URL: ${targetUrl}\n`);

(async () => {
  let stagehand;

  try {
    console.log("🚀 Launching browser...");
    stagehand = new Stagehand(stagehandopts);
    await stagehand.init();
    console.log("✅ Browser initialized\n");
    
    const page = stagehand.context.pages()[0];
    
    console.log("🌐 Navigating to target...");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ Page loaded\n");

    console.log("=" + "=".repeat(79));
    console.log("🤖 AGENT STARTING - Autonomous Mode");
    console.log("=" + "=".repeat(79) + "\n");

    // Create autonomous agent
    const agent = stagehand.agent({
      model: "meta/llama-3.1-8b-instruct",
      mode: "dom",  // Use DOM-based mode for better understanding
      systemPrompt: `You are an expert web scraping agent. Your task is to:
1. Observe and understand the webpage structure
2. Extract the requested data
3. Navigate through pagination if needed
4. Return structured results

Be thorough and extract all requested information. If pagination exists, navigate through multiple pages to collect more data.`,
    });

    // Define a flexible output schema
    const OutputSchema = z.object({
      data: z.array(z.record(z.string(), z.any())).describe("Array of extracted items with their properties"),
      totalItems: z.number().describe("Total number of items extracted"),
      pagesScraped: z.number().optional().describe("Number of pages scraped if pagination was used"),
      summary: z.string().describe("Brief summary of what was extracted"),
    });

    console.log("🎯 Agent executing your task...\n");
    
    // Execute the autonomous task
    const result = await agent.execute({
      instruction: userPrompt,
      maxSteps: 30,  // Allow up to 30 steps for complex tasks
      output: OutputSchema,
    });

    console.log("\n" + "=".repeat(80));
    console.log("✅ AGENT COMPLETED");
    console.log("=".repeat(80) + "\n");

    if (result.output) {
      console.log("📊 RESULTS:");
      console.log("-".repeat(80));
      console.log(`📝 Summary: ${result.output.summary}`);
      console.log(`📰 Total Items: ${result.output.totalItems}`);
      if (result.output.pagesScraped) {
        console.log(`📄 Pages Scraped: ${result.output.pagesScraped}`);
      }
      
      console.log("\n🎯 Extracted Data:");
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

      // Save results to file
      const fs = await import('fs/promises');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `scraping-results-${timestamp}.json`;
      
      await fs.writeFile(filename, JSON.stringify(result.output, null, 2));
      console.log(`\n💾 Full results saved to: ${filename}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("🎉 Autonomous scraping completed!");
    console.log("=".repeat(80));

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.stack) {
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
