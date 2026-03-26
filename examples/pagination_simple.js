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

console.log("🚀 Pagination Test");
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

      const result = await stagehand.extract(
        `Extract the first 10 story titles from the page`,
        TitlesSchema
      );

      allStories = allStories.concat(result.titles);
      console.log(`  ✅ Extracted ${result.titles.length} stories`);
      console.log(`  📊 Total: ${allStories.length} stories\n`);

      if (pageNum < maxPages) {
        // Use Playwright directly for navigation
        const moreLink = page.locator('a.morelink');
        const count = await moreLink.count();
        
        if (count > 0) {
          console.log(`  🔄 Clicking 'More' link...`);
          await moreLink.click();
          await page.waitForLoadState("domcontentloaded");
          await new Promise(r => setTimeout(r, 1000));
          console.log(`  ✅ Loaded page ${pageNum + 1}\n`);
        } else {
          console.log(`  ⚠️  No more pages\n`);
          break;
        }
      }
    }

    console.log("=" + "=".repeat(79));
    console.log(`✅ SUCCESS: Collected ${allStories.length} stories from ${maxPages} pages`);
    console.log("=" + "=".repeat(79));
    
    console.log("\n📰 First 5 stories:");
    allStories.slice(0, 5).forEach((title, i) => {
      console.log(`${i + 1}. ${title.substring(0, 70)}...`);
    });

    console.log("\n📰 Last 5 stories:");
    allStories.slice(-5).forEach((title, i) => {
      console.log(`${allStories.length - 4 + i}. ${title.substring(0, 70)}...`);
    });

    console.log("\n🎉 Pagination test completed!");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    if (stagehand) await stagehand.close();
  }
})();
