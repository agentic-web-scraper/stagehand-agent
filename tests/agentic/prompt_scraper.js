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

console.log("🤖 Prompt-Based Web Scraper");
console.log("=" + "=".repeat(79));
console.log("💬 Just tell me what to scrape!");
console.log("=" + "=".repeat(79) + "\n");

const userPrompt = process.argv[2];
const targetUrl = process.argv[3];
const maxPages = parseInt(process.argv[4]) || 3;

if (!userPrompt || !targetUrl) {
  console.log("❌ Usage: node tests/prompt_scraper.js \"<what to extract>\" \"<url>\" [pages]\n");
  console.log("📝 Examples:");
  console.log('  node tests/prompt_scraper.js "story titles and points" "https://news.ycombinator.com" 3');
  console.log('  node tests/prompt_scraper.js "product names and prices" "https://example.com/shop" 2');
  process.exit(1);
}

console.log(`💬 Extract: "${userPrompt}"`);
console.log(`🌐 URL: ${targetUrl}`);
console.log(`📄 Pages: ${maxPages}\n`);

(async () => {
  let stagehand;

  try {
    stagehand = new Stagehand(stagehandopts);
    await stagehand.init();
    const page = stagehand.context.pages()[0];
    
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ Page loaded\n");

    const ContentSchema = z.object({
      items: z.array(z.record(z.string(), z.any())).describe("Extracted items"),
    });

    let allData = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`📖 Page ${pageNum}/${maxPages} - Extracting...`);

      try {
        const result = await stagehand.extract(
          `Extract ${userPrompt} from this page`,
          ContentSchema
        );

        allData = allData.concat(result.items);
        console.log(`  ✅ Got ${result.items.length} items (Total: ${allData.length})`);

        if (pageNum < maxPages) {
          // Try to find and click next/more
          const nextActions = await stagehand.observe("find next page or more link");
          
          if (nextActions.length > 0) {
            console.log(`  🔄 Going to next page...`);
            await stagehand.act(nextActions[0]);
            await page.waitForLoadState("domcontentloaded");
            await new Promise(r => setTimeout(r, 1000));
          } else {
            console.log(`  ⚠️  No more pages`);
            break;
          }
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message.substring(0, 80)}`);
        break;
      }
    }

    console.log(`\n✅ Done! Collected ${allData.length} items\n`);
    
    console.log("📊 Sample (first 5):");
    allData.slice(0, 5).forEach((item, i) => {
      console.log(`\n${i + 1}.`);
      Object.entries(item).forEach(([k, v]) => {
        console.log(`   ${k}: ${String(v).substring(0, 60)}`);
      });
    });

    // Save
    const fs = await import('fs/promises');
    const filename = `results-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify({ prompt: userPrompt, url: targetUrl, data: allData }, null, 2));
    console.log(`\n💾 Saved to: ${filename}`);

  } catch (error) {
    console.error("\n❌", error.message);
  } finally {
    if (stagehand) await stagehand.close();
  }
})();
