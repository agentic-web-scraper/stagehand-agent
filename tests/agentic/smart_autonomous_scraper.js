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
  verbose: 0,
};

console.log("🤖 Smart Autonomous Web Scraping Agent");
console.log("=" + "=".repeat(79));
console.log("💬 Give me a prompt, I'll figure out the rest!");
console.log("🧠 Powered by NVIDIA NIM + Stagehand");
console.log("=" + "=".repeat(79) + "\n");

// Get user prompt from command line
const userPrompt = process.argv[2];
const targetUrl = process.argv[3];
const maxPages = parseInt(process.argv[4]) || 3;

if (!userPrompt || !targetUrl) {
  console.log("❌ Usage: node tests/smart_autonomous_scraper.js \"<prompt>\" \"<url>\" [maxPages]\n");
  console.log("📝 Examples:");
  console.log('  node tests/smart_autonomous_scraper.js "Get story titles" "https://news.ycombinator.com" 3');
  console.log('  node tests/smart_autonomous_scraper.js "Find product names and prices" "https://example.com/shop" 5');
  console.log('  node tests/smart_autonomous_scraper.js "Extract article titles and authors" "https://blog.example.com" 2');
  process.exit(1);
}

console.log(`💬 Your prompt: "${userPrompt}"`);
console.log(`🌐 Target URL: ${targetUrl}`);
console.log(`📄 Max pages: ${maxPages}\n`);

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
    console.log("🤖 AUTONOMOUS AGENT STARTING");
    console.log("=" + "=".repeat(79) + "\n");

    // STEP 1: Observe the page to understand structure
    console.log("🔍 STEP 1: Analyzing page structure...");
    const pageElements = await stagehand.observe("find all content items, articles, or data on the page");
    console.log(`  ✅ Found ${pageElements.length} content elements\n`);

    // STEP 2: Identify pagination
    console.log("🔍 STEP 2: Looking for pagination controls...");
    const paginationElements = await stagehand.observe(
      "find pagination links, next page buttons, more buttons, or page numbers"
    );
    const hasPagination = paginationElements.length > 0;
    console.log(`  ${hasPagination ? '✅' : '⚠️'}  ${hasPagination ? `Found ${paginationElements.length} pagination controls` : 'No pagination found'}\n`);

    // STEP 3: Create dynamic extraction schema based on prompt
    console.log("🔍 STEP 3: Preparing data extraction...");
    const ContentSchema = z.object({
      items: z.array(z.record(z.string(), z.any())).describe("Array of extracted items based on user request"),
    });

    let allData = [];
    let pageNum = 1;

    console.log("=" + "=".repeat(79));
    console.log("📊 EXTRACTING DATA");
    console.log("=".repeat(80) + "\n");

    for (pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`📖 Page ${pageNum}/${maxPages}`);
      console.log(`  🤖 AI: Extracting data based on your prompt...`);

      try {
        // Extract data based on user prompt
        const result = await stagehand.extract(
          userPrompt,
          ContentSchema
        );

        allData = allData.concat(result.items);
        console.log(`  ✅ Extracted ${result.items.length} items`);
        console.log(`  📊 Total collected: ${allData.length} items`);

        if (result.items.length > 0) {
          const firstItem = result.items[0];
          const preview = Object.entries(firstItem).slice(0, 2).map(([k, v]) => 
            `${k}: ${String(v).substring(0, 40)}...`
          ).join(', ');
          console.log(`  📰 Sample: ${preview}`);
        }

        // Navigate to next page if pagination exists
        if (pageNum < maxPages && hasPagination) {
          console.log(`\n  🔍 Looking for next page...`);
          
          const nextPageOptions = await stagehand.observe(
            "find the next page link, more button, or pagination control to go to the next page"
          );
          
          if (nextPageOptions.length > 0) {
            console.log(`  ✅ Found: ${nextPageOptions[0].description}`);
            console.log(`  🎬 AI: Navigating...`);
            
            await stagehand.act(nextPageOptions[0]);
            await page.waitForLoadState("domcontentloaded");
            await new Promise(r => setTimeout(r, 1500));
            
            console.log(`  ✅ Navigated to page ${pageNum + 1}\n`);
          } else {
            console.log(`  ⚠️  No more pages\n`);
            break;
          }
        }

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        
        if (error.message.includes('Failed to parse model response as JSON')) {
          console.log(`  🔄 Retrying...`);
          await new Promise(r => setTimeout(r, 2000));
          
          try {
            const result = await stagehand.extract(userPrompt, ContentSchema);
            allData = allData.concat(result.items);
            console.log(`  ✅ Retry successful: ${result.items.length} items\n`);
          } catch (retryError) {
            console.log(`  ❌ Retry failed, skipping\n`);
          }
        } else {
          break;
        }
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ AUTONOMOUS SCRAPING COMPLETED");
    console.log("=".repeat(80) + "\n");

    console.log("📊 RESULTS:");
    console.log("-".repeat(80));
    console.log(`📰 Total Items: ${allData.length}`);
    console.log(`📄 Pages Scraped: ${Math.min(pageNum, maxPages)}`);
    console.log(`📈 Average per page: ${Math.round(allData.length / Math.min(pageNum, maxPages))}`);
    
    console.log("\n🎯 Extracted Data (first 10 items):");
    console.log("-".repeat(80));
    
    allData.slice(0, 10).forEach((item, i) => {
      console.log(`\n${i + 1}.`);
      Object.entries(item).forEach(([key, value]) => {
        const displayValue = typeof value === 'string' && value.length > 70 
          ? value.substring(0, 70) + "..." 
          : value;
        console.log(`   ${key}: ${displayValue}`);
      });
    });

    if (allData.length > 10) {
      console.log(`\n... and ${allData.length - 10} more items`);
    }

    // Save results to file
    const fs = await import('fs/promises');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `scraping-results-${timestamp}.json`;
    
    const output = {
      prompt: userPrompt,
      url: targetUrl,
      timestamp: new Date().toISOString(),
      totalItems: allData.length,
      pagesScraped: Math.min(pageNum, maxPages),
      data: allData,
    };
    
    await fs.writeFile(filename, JSON.stringify(output, null, 2));
    console.log(`\n💾 Full results saved to: ${filename}`);

    console.log("\n" + "=".repeat(80));
    console.log("🎉 Mission accomplished!");
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
