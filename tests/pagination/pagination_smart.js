'use strict';

import { Stagehand, CustomOpenAIClient } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
process.env.OPENAI_API_KEY = process.env.NVIDIA_API_KEY;

const lpdopts = { host: '127.0.0.1', port: 9222 };

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
    cdpUrl: 'ws://' + lpdopts.host + ':' + lpdopts.port,
  },
  llmClient: new CustomOpenAIClient({
    modelName: "meta/llama-3.1-8b-instruct",
    client: openaiClient,
  }),
  verbose: 0,
};

console.log("🤖 Smart AI Pagination Agent");
console.log("=" + "=".repeat(79));
console.log("🔍 Uses observe() to discover pagination dynamically");
console.log("📡 Adaptive extraction without hardcoded selectors");
console.log("=" + "=".repeat(79) + "\n");

(async () => {
  let stagehand;

  try {
    stagehand = new Stagehand(stagehandopts);
    await stagehand.init();
    const page = await stagehand.context.newPage();
    
    // Get URL from command line or use default
    const targetUrl = process.argv[2] || 'https://news.ycombinator.com/newest';
    console.log(`🌐 Target: ${targetUrl}\n`);
    
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ Page loaded\n");

    // Define schema for extraction (generic)
    const ContentSchema = z.object({
      items: z.array(z.object({
        title: z.string().describe("Title or heading of the item"),
        metadata: z.string().optional().describe("Additional info like author, date, points"),
      })).describe("List of content items on the page"),
    });

    let allItems = [];
    const maxPages = 3;
    let pageNum = 1;

    for (pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`📖 Page ${pageNum}/${maxPages}`);

      try {
        // STEP 1: Extract content
        console.log(`  🤖 AI: Extracting content...`);
        const result = await stagehand.extract(
          "Extract all content items from the page with their titles and any metadata",
          ContentSchema
        );

        allItems = allItems.concat(result.items);
        console.log(`  ✅ Extracted ${result.items.length} items`);
        console.log(`  📊 Total collected: ${allItems.length} items`);

        if (result.items.length > 0) {
          console.log(`  📰 Sample: "${result.items[0].title.substring(0, 60)}..."`);
        }

        // STEP 2: Navigate to next page using observe
        if (pageNum < maxPages) {
          console.log(`\n  🔍 AI: Discovering pagination controls...`);
          
          // Use observe to find pagination
          const paginationActions = await stagehand.observe(
            "find the next page link, more button, or pagination control"
          );
          
          if (paginationActions.length > 0) {
            console.log(`  ✅ Found: ${paginationActions[0].description}`);
            console.log(`  🎬 AI: Clicking to navigate...`);
            
            // Execute the discovered action
            await stagehand.act(paginationActions[0]);
            
            await page.waitForLoadState("domcontentloaded");
            await new Promise(r => setTimeout(r, 1500));
            
            console.log(`  ✅ Navigated to page ${pageNum + 1}\n`);
          } else {
            console.log(`  ⚠️  No pagination controls found\n`);
            break;
          }
        }

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        
        // Retry logic for JSON parse errors
        if (error.message.includes('Failed to parse model response as JSON')) {
          console.log(`  🔄 Retrying extraction...`);
          await new Promise(r => setTimeout(r, 2000));
          
          try {
            const result = await stagehand.extract(
              "Extract all content items from the page",
              ContentSchema
            );
            allItems = allItems.concat(result.items);
            console.log(`  ✅ Retry successful: ${result.items.length} items\n`);
          } catch (retryError) {
            console.log(`  ❌ Retry failed, skipping\n`);
          }
        } else if (error.message.includes('uninitialized') || error.message.includes('CDP')) {
          console.log(`  ⚠️  Connection issue, stopping pagination\n`);
          break;
        } else {
          break;
        }
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 SMART PAGINATION RESULTS");
    console.log("=".repeat(80));
    console.log(`✅ Pages scraped: ${Math.min(pageNum, maxPages)}`);
    console.log(`📰 Total items: ${allItems.length}`);
    if (allItems.length > 0) {
      console.log(`📈 Average per page: ${Math.round(allItems.length / Math.min(pageNum, maxPages))}`);
    }

    console.log("\n🎯 First 10 items:");
    allItems.slice(0, 10).forEach((item, i) => {
      const title = item.title.length > 70 ? item.title.substring(0, 70) + "..." : item.title;
      console.log(`${i + 1}. ${title}`);
      if (item.metadata) {
        console.log(`   ${item.metadata.substring(0, 60)}...`);
      }
    });

    if (allItems.length > 10) {
      console.log("\n🎯 Last 3 items:");
      allItems.slice(-3).forEach((item, i) => {
        const title = item.title.length > 70 ? item.title.substring(0, 70) + "..." : item.title;
        console.log(`${allItems.length - 2 + i}. ${title}`);
      });
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ SMART PAGINATION COMPLETED");
    console.log("=".repeat(80));
    console.log("\n💡 The agent:");
    console.log("  • Used observe() to discover pagination controls");
    console.log("  • Extracted content without hardcoded selectors");
    console.log("  • Navigated using AI-discovered actions");
    console.log("  • Handled NVIDIA NIM response format automatically");
    console.log("\n🎉 Adaptive pagination agent working!");
    console.log("\n📝 Usage: node tests/pagination_smart.js [URL]");

  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
})();
