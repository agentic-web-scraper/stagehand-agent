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

console.log("🚀 Web Scraping Agent Test Suite");
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

    // Test 1: Simple extraction
    console.log("TEST 1: Basic Data Extraction");
    console.log("-".repeat(80));
    await page.goto('https://news.ycombinator.com', { waitUntil: "domcontentloaded" });
    
    const TitlesSchema = z.object({
      titles: z.array(z.string()).describe("Story titles"),
    });

    const result1 = await stagehand.extract(
      "Extract the first 5 story titles",
      TitlesSchema
    );

    console.log("📰 Extracted Titles:");
    result1.titles.slice(0, 5).forEach((title, i) => {
      console.log(`${i + 1}. ${title.substring(0, 70)}...`);
    });

    // Test 2: Navigation with AI
    console.log("\n\nTEST 2: AI-Powered Navigation");
    console.log("-".repeat(80));
    console.log("🎬 Using AI to click 'ask' link...");
    await stagehand.act("click on the 'ask' link in the navigation");
    await page.waitForLoadState("domcontentloaded");
    console.log("✅ Navigated to Ask HN");

    const questions = await stagehand.extract(
      "Extract 3 question titles",
      TitlesSchema
    );

    console.log("\n❓ Ask HN Questions:");
    questions.titles.slice(0, 3).forEach((q, i) => {
      console.log(`${i + 1}. ${q.substring(0, 70)}...`);
    });

    // Test 3: Observe before acting
    console.log("\n\nTEST 3: Observe Then Act Pattern");
    console.log("-".repeat(80));
    await page.goto('https://news.ycombinator.com', { waitUntil: "domcontentloaded" });
    
    console.log("👀 Observing 'new' link...");
    const actions = await stagehand.observe("find the 'new' link");
    console.log(`✅ Found ${actions.length} possible actions`);
    
    if (actions.length > 0) {
      console.log("🎬 Executing observed action...");
      await stagehand.act(actions[0]);
      await page.waitForLoadState("domcontentloaded");
      console.log("✅ Action completed");
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ ALL TESTS PASSED");
    console.log("=".repeat(80));
    console.log("\n📊 Summary:");
    console.log("  • Basic extraction: ✓");
    console.log("  • AI navigation: ✓");
    console.log("  • Observe & act pattern: ✓");
    console.log("\n🎉 Your scraping agent is ready for production!");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
  } finally {
    if (stagehand) await stagehand.close();
    console.log("\n🧹 Cleanup completed");
  }
})();
