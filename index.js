'use strict';

import { lightpanda } from '@lightpanda/browser';
import { Stagehand, CustomOpenAIClient } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

// Set OPENAI_API_KEY for Stagehand's OpenAI provider to use NVIDIA NIM
process.env.OPENAI_API_KEY = process.env.NVIDIA_API_KEY;

const lpdopts = {
  host: '127.0.0.1',
  port: 9222
};

// Create custom OpenAI client for NVIDIA NIM
const openaiClient = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_BASE_URL,
});

const stagehandopts = {
  // Enable LOCAL env to configure the CDP url manually in the launch options.
  env: "LOCAL",
  localBrowserLaunchOptions: {
    cdpUrl: 'ws://' + lpdopts.host + ':' + lpdopts.port,
  },
  // Use custom OpenAI client with NVIDIA NIM
  llmClient: new CustomOpenAIClient({
    modelName: "meta/llama-3.1-8b-instruct",
    client: openaiClient,
  }),
  verbose: 0,  // Set to 0 for clean output, 1 for detailed logs, 2 for debug
};

// Define schema for stories
const StorySchema = z.object({
  title: z.string().describe("Story title"),
  url: z.string().describe("Story URL"),
  points: z.number().describe("Story points/score"),
});

const StoriesSchema = z.object({
  stories: z.array(StorySchema).describe("List of stories"),
});

(async () => {
  console.log("🚀 Starting Lightpanda + Stagehand + NVIDIA NIM integration...");
  console.log(`📡 Lightpanda CDP: ws://${lpdopts.host}:${lpdopts.port}`);
  console.log(`🤖 NVIDIA NIM: ${process.env.NVIDIA_BASE_URL}`);
  console.log(`🧠 Model: meta/llama-3.1-8b-instruct\n`);

  // Note: We're connecting to an already running Lightpanda instance
  // instead of starting a new one
  let stagehand;

  try {
    // Connect Stagehand to the browser.
    console.log("🔌 Connecting Stagehand to Lightpanda...");
    stagehand = new Stagehand(stagehandopts);

    await stagehand.init();
    console.log("✅ Stagehand initialized\n");

    // Important: Lightpanda requires an explicit page creation
    const page = await stagehand.context.newPage();
    console.log("✅ New page created\n");

    // Navigate to Hacker News
    console.log("🌐 Navigating to Hacker News...");
    await page.goto('https://news.ycombinator.com', { waitUntil: "networkidle" });
    console.log("✅ Page loaded\n");

    // Use Stagehand to extract structured data
    console.log(" OExtracting top 3 stories with AI...");
    const stories = await stagehand.extract(
      "Extract the first 50 story titles from the page",
      z.object({
        titles: z.array(z.string()).describe("List of story titles"),
      })
    );

    console.log("\n📰 Extracted Stories:");
    console.log("=".repeat(80));
    stories.titles.forEach((title, i) => {
      console.log(`${i + 1}. ${title}`);
    });
    console.log("\n" + "=".repeat(80));

    await stagehand.close();
    console.log("\n✅ Done!");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
  } finally {
    if (stagehand) {
      await stagehand.close().catch(() => {});
    }
  }
})();
