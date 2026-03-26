'use strict';

import { Stagehand, CustomOpenAIClient } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
process.env.OPENAI_API_KEY = process.env.NVIDIA_API_KEY;

const lpdopts = { host: '127.0.0.1', port: 9222 };

// Create a wrapper around OpenAI client that cleans NVIDIA NIM responses
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
          
          // Clean up NVIDIA NIM responses that include schema + data
          if (response.choices?.[0]?.message?.content) {
            let content = response.choices[0].message.content;
            
            // NVIDIA NIM sometimes returns: schema\n\ndata
            // Find all complete JSON objects
            const jsonMatches = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
            if (jsonMatches && jsonMatches.length > 1) {
              // Use the last JSON object (actual data, not schema)
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

console.log("🤖 AI-Powered Pagination Agent (NVIDIA NIM Fixed)");
console.log("=" + "=".repeat(79));
console.log("📡 Using AI for BOTH extraction AND navigation");
console.log("🔧 With response cleaning for NVIDIA NIM");
console.log("=" + "=".repeat(79) + "\n");

(async () => {
  let stagehand;

  try {
    stagehand = new Stagehand(stagehandopts);
    await stagehand.init();
    const page = await stagehand.context.newPage();
    
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: "domcontentloaded" });
    console.log("✅ Loaded Hacker News\n");

    const TitlesSchema = z.object({
      titles: z.array(z.string()).describe("Story titles from the page"),
    });

    let allStories = [];
    const maxPages = 3;
    let pageNum = 1;

    for (pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`📖 Page ${pageNum}/${maxPages}`);
      console.log(`  🤖 AI: Extracting stories...`);

      try {
        // AI EXTRACTION
        const result = await stagehand.extract(
          `Extract all story titles from the current page`,
          TitlesSchema
        );

        allStories = allStories.concat(result.titles);
        console.log(`  ✅ Extracted ${result.titles.length} stories`);
        console.log(`  📊 Total collected: ${allStories.length} stories`);

        // Show sample
        if (result.titles.length > 0) {
          console.log(`  📰 Sample: "${result.titles[0].substring(0, 60)}..."`);
        }

        // AI NAVIGATION
        if (pageNum < maxPages) {
          console.log(`\n  🤖 AI: Looking for 'More' link...`);
          
          // Check if More link exists - try multiple selectors
          let moreExists = await page.locator('a:has-text("More")').count() > 0;
          if (!moreExists) {
            moreExists = await page.locator('a.morelink').count() > 0;
          }
          
          if (moreExists) {
            console.log(`  🎬 AI: Clicking 'More' to navigate...`);
            
            // Use AI to click the More link
            await stagehand.act("click on the 'More' link at the bottom of the page");
            
            // Wait for navigation
            await page.waitForLoadState("domcontentloaded");
            await new Promise(r => setTimeout(r, 1500));
            
            console.log(`  ✅ Navigated to page ${pageNum + 1}\n`);
          } else {
            console.log(`  ⚠️  No more pages available\n`);
            break;
          }
        }

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        
        // If it's a JSON parse error, retry once
        if (error.message.includes('Failed to parse model response as JSON')) {
          console.log(`  🔄 Retrying extraction...`);
          await new Promise(r => setTimeout(r, 2000));
          
          try {
            const result = await stagehand.extract(
              `Extract all story titles from the current page`,
              TitlesSchema
            );
            allStories = allStories.concat(result.titles);
            console.log(`  ✅ Retry successful: ${result.titles.length} stories`);
            console.log(`  📊 Total: ${allStories.length} stories\n`);
          } catch (retryError) {
            console.log(`  ❌ Retry failed: ${retryError.message}`);
            console.log(`  ⏭️  Skipping to next page\n`);
          }
        } else {
          break;
        }
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 PAGINATION RESULTS");
    console.log("=".repeat(80));
    console.log(`✅ Pages scraped: ${Math.min(pageNum, maxPages)}`);
    console.log(`📰 Total stories: ${allStories.length}`);
    console.log(`📈 Average per page: ${Math.round(allStories.length / Math.min(pageNum, maxPages))}`);

    console.log("\n🎯 First 10 stories:");
    allStories.slice(0, 10).forEach((title, i) => {
      const shortTitle = title.length > 70 ? title.substring(0, 70) + "..." : title;
      console.log(`${i + 1}. ${shortTitle}`);
    });

    if (allStories.length > 10) {
      console.log("\n🎯 Last 5 stories:");
      allStories.slice(-5).forEach((title, i) => {
        const shortTitle = title.length > 70 ? title.substring(0, 70) + "..." : title;
        console.log(`${allStories.length - 4 + i}. ${shortTitle}`);
      });
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ AI AGENT PAGINATION COMPLETED");
    console.log("=".repeat(80));
    console.log("\n💡 The agent used AI for:");
    console.log("  • Extracting story data from each page");
    console.log("  • Finding and clicking the 'More' link");
    console.log("  • Navigating through multiple pages");
    console.log("\n🎉 Your AI pagination agent is working!");

  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    console.error(error.stack);
  } finally {
    if (stagehand) await stagehand.close();
  }
})();
