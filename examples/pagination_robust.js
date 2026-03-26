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

// Helper function to extract with retry on JSON parse errors
async function extractWithRetry(stagehand, instruction, schema, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await stagehand.extract(instruction, schema);
    } catch (error) {
      if (error.message.includes('Failed to parse model response as JSON') && attempt < maxRetries) {
        console.log(`  ⚠️  JSON parse error (attempt ${attempt}/${maxRetries}), retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw error;
    }
  }
}

console.log("🚀 Robust Pagination Test - With Retry Logic");
console.log("=" + "=".repeat(79));

(async () => {
  let stagehand;

  try {
    stagehand = new Stagehand(stagehandopts);
    await stagehand.init();
    const page = await stagehand.context.newPage();
    
    await page.goto('https://news.ycombinator.com/newest', { waitUntil: "domcontentloaded" });
    console.log("✅ Loaded page 1\n");

    const TitlesSchema = z.object({
      titles: z.array(z.string()).describe("Story titles"),
    });

    let allStories = [];
    const maxPages = 3;

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`📖 Page ${pageNum}/${maxPages}`);

      try {
        // Use retry wrapper for extraction
        const result = await extractWithRetry(
          stagehand,
          `Extract all story titles from the current page`,
          TitlesSchema,
          3
        );

        allStories = allStories.concat(result.titles);
        console.log(`  ✅ Extracted ${result.titles.length} stories`);
        console.log(`  📊 Total: ${allStories.length} stories\n`);

        if (pageNum < maxPages) {
          const moreLink = page.locator('a.morelink');
          const count = await moreLink.count();
          
          if (count > 0) {
            console.log(`  🔄 Navigating to page ${pageNum + 1}...`);
            await moreLink.click();
            await page.waitForLoadState("domcontentloaded");
            await new Promise(r => setTimeout(r, 1000));
          } else {
            console.log(`  ⚠️  No more pages\n`);
            break;
          }
        }
      } catch (error) {
        console.log(`  ❌ Error on page ${pageNum}: ${error.message}`);
        break;
      }
    }

    console.log("=" + "=".repeat(79));
    console.log(`✅ SUCCESS: Collected ${allStories.length} stories from ${maxPages} pages`);
    console.log("=" + "=".repeat(79));
    
    console.log("\n📰 Sample stories:");
    allStories.slice(0, 10).forEach((title, i) => {
      console.log(`${i + 1}. ${title.substring(0, 70)}...`);
    });

    console.log("\n🎉 Pagination test completed with retry logic!");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    if (stagehand) await stagehand.close();
  }
})();
