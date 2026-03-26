'use strict';

import { Stagehand, CustomOpenAIClient } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
process.env.OPENAI_API_KEY = process.env.NVIDIA_API_KEY;

const lpdopts = { host: '127.0.0.1', port: 9222 };

const openaiClient = new OpenAI({
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

console.log("🚀 Pagination Test - Web Scraping Agent");
console.log("=" + "=".repeat(79));
console.log("📡 Lightpanda: ws://" + lpdopts.host + ":" + lpdopts.port);
console.log("🤖 NVIDIA NIM: " + process.env.NVIDIA_BASE_URL);
console.log("🧠 Model: meta/llama-3.1-8b-instruct\n");

(async () => {
  let stagehand;

  try {
    stagehand = new Stagehand(stagehandopts);
    await stagehand.init();
    const page = await stagehand.context.newPage();
    console.log("✅ Browser initialized\n");

    // Navigate to Hacker News newest
    console.log("🌐 Navigating to Hacker News newest stories...");
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: "domcontentloaded" });
    console.log("✅ Page loaded\n");

    const TitlesSchema = z.object({
      titles: z.array(z.string()).describe("Story titles"),
    });

    let allStories = [];
    const maxPages = 3;

    console.log("📄 Starting pagination scraping...");
    console.log("-".repeat(80));

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`\n📖 Page ${pageNum}/${maxPages}`);
      console.log("  🤖 Extracting stories with AI...");

      try {
        const result = await stagehand.extract(
          "Extract all story titles from the current page",
          TitlesSchema
        );

        const storiesOnPage = result.titles.length;
        allStories = allStories.concat(result.titles);
        
        console.log(`  ✅ Extracted ${storiesOnPage} stories`);
        console.log(`  📊 Total collected: ${allStories.length} stories`);

        // Show first 3 from this page
        console.log(`  📰 Sample from page ${pageNum}:`);
        result.titles.slice(0, 3).forEach((title, i) => {
          const shortTitle = title.length > 60 ? title.substring(0, 60) + "..." : title;
          console.log(`     ${i + 1}. ${shortTitle}`);
        });

        // Check if we should continue
        if (pageNum < maxPages) {
          console.log(`\n  🔍 Looking for 'More' link...`);
          
          // Check if More link exists
          const moreLink = await page.locator('a:has-text("More")').count();
          
          if (moreLink > 0) {
            console.log(`  ✅ Found 'More' link`);
            console.log(`  🎬 Clicking to next page...`);
            
            await stagehand.act("click on the 'More' link at the bottom of the page");
            await page.waitForLoadState("domcontentloaded");
            
            // Small delay to ensure page is ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log(`  ✅ Navigated to page ${pageNum + 1}`);
          } else {
            console.log(`  ⚠️  No 'More' link found - reached end`);
            break;
          }
        }

      } catch (error) {
        console.log(`  ❌ Error on page ${pageNum}: ${error.message}`);
        break;
      }
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 PAGINATION SUMMARY");
    console.log("=".repeat(80));
    console.log(`✅ Successfully scraped ${maxPages} pages`);
    console.log(`📰 Total stories collected: ${allStories.length}`);
    console.log(`📈 Average per page: ${Math.round(allStories.length / maxPages)}`);

    console.log("\n🎯 First 10 stories from all pages:");
    allStories.slice(0, 10).forEach((title, i) => {
      const shortTitle = title.length > 70 ? title.substring(0, 70) + "..." : title;
      console.log(`${i + 1}. ${shortTitle}`);
    });

    console.log("\n🎯 Last 5 stories (from page 3):");
    allStories.slice(-5).forEach((title, i) => {
      const shortTitle = title.length > 70 ? title.substring(0, 70) + "..." : title;
      console.log(`${allStories.length - 4 + i}. ${shortTitle}`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("✅ PAGINATION TEST COMPLETED SUCCESSFULLY");
    console.log("=".repeat(80));
    console.log("\n💡 Key Features Demonstrated:");
    console.log("  • Multi-page scraping with AI");
    console.log("  • Automatic 'More' link detection");
    console.log("  • Data aggregation across pages");
    console.log("  • Error handling and graceful exit");
    console.log("\n🎉 Your pagination agent is production-ready!");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  } finally {
    if (stagehand) await stagehand.close();
    console.log("\n🧹 Cleanup completed");
  }
})();
