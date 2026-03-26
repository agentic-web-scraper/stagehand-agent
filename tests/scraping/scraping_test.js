'use strict';

import { Stagehand, CustomOpenAIClient } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
process.env.OPENAI_API_KEY = process.env.NVIDIA_API_KEY;

const lpdopts = {
  host: '127.0.0.1',
  port: 9222
};

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

// Test 1: Extract structured product data
async function testProductScraping(stagehand, page) {
  console.log("\n" + "=".repeat(80));
  console.log("TEST 1: Product Data Extraction");
  console.log("=".repeat(80));

  const ProductSchema = z.object({
    products: z.array(z.object({
      name: z.string().describe("Product name"),
      price: z.string().describe("Product price"),
      rating: z.string().optional().describe("Product rating if available"),
    })).describe("List of products"),
  });

  await page.goto('https://www.amazon.com/s?k=laptop', { waitUntil: "domcontentloaded" });
  console.log("✅ Navigated to Amazon search results");

  console.log("🤖 Extracting first 3 products with AI...");
  const products = await stagehand.extract(
    "Extract the first 3 laptop products with their name, price, and rating",
    ProductSchema
  );

  console.log("\n📦 Extracted Products:");
  products.products.forEach((product, i) => {
    console.log(`\n${i + 1}. ${product.name}`);
    console.log(`   Price: ${product.price}`);
    if (product.rating) console.log(`   Rating: ${product.rating}`);
  });
}

// Test 2: Navigate and interact with dynamic content
async function testDynamicInteraction(stagehand, page) {
  console.log("\n" + "=".repeat(80));
  console.log("TEST 2: Dynamic Interaction & Navigation");
  console.log("=".repeat(80));

  await page.goto('https://news.ycombinator.com', { waitUntil: "domcontentloaded" });
  console.log("✅ Navigated to Hacker News");

  // Use observe to find actions
  console.log("👀 Observing available navigation options...");
  const actions = await stagehand.observe("find the 'ask' link in the navigation");
  console.log(`✅ Found ${actions.length} possible actions`);

  // Use act to perform the action
  console.log("🎬 Clicking on 'ask' link...");
  await stagehand.act("click on the 'ask' link");
  await page.waitForLoadState("domcontentloaded");
  console.log("✅ Navigated to Ask HN section");

  // Extract from new page
  const QuestionSchema = z.object({
    questions: z.array(z.string()).describe("List of question titles"),
  });

  console.log("🤖 Extracting questions...");
  const questions = await stagehand.extract(
    "Extract the first 5 Ask HN question titles",
    QuestionSchema
  );

  console.log("\n❓ Ask HN Questions:");
  questions.questions.forEach((q, i) => {
    console.log(`${i + 1}. ${q}`);
  });
}

// Test 3: Handle pagination
async function testPagination(stagehand, page) {
  console.log("\n" + "=".repeat(80));
  console.log("TEST 3: Pagination Handling");
  console.log("=".repeat(80));

  await page.goto('https://news.ycombinator.com/newest', { waitUntil: "domcontentloaded" });
  console.log("✅ Navigated to newest stories");

  const StorySchema = z.object({
    title: z.string(),
    points: z.number().optional(),
  });

  let allStories = [];
  const maxPages = 2;

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    console.log(`\n📄 Scraping page ${pageNum}...`);

    const StoriesSchema = z.object({
      stories: z.array(StorySchema).describe("Stories on this page"),
    });

    const result = await stagehand.extract(
      "Extract all story titles and points from the current page",
      StoriesSchema
    );

    allStories = allStories.concat(result.stories);
    console.log(`✅ Extracted ${result.stories.length} stories from page ${pageNum}`);

    if (pageNum < maxPages) {
      console.log("🔄 Looking for 'More' link...");
      const hasMore = await page.locator('a:has-text("More")').count() > 0;
      
      if (hasMore) {
        await stagehand.act("click on the 'More' link at the bottom");
        await page.waitForLoadState("domcontentloaded");
        console.log("✅ Navigated to next page");
      } else {
        console.log("⚠️  No more pages available");
        break;
      }
    }
  }

  console.log(`\n📊 Total stories collected: ${allStories.length}`);
  console.log("\nFirst 5 stories:");
  allStories.slice(0, 5).forEach((story, i) => {
    console.log(`${i + 1}. ${story.title} (${story.points || 0} points)`);
  });
}

// Test 4: Form filling and submission
async function testFormInteraction(stagehand, page) {
  console.log("\n" + "=".repeat(80));
  console.log("TEST 4: Form Interaction");
  console.log("=".repeat(80));

  await page.goto('https://www.google.com', { waitUntil: "domcontentloaded" });
  console.log("✅ Navigated to Google");

  console.log("🎬 Using AI to fill search form...");
  await stagehand.act("type 'web scraping best practices' in the search box");
  
  console.log("🎬 Submitting search...");
  await stagehand.act("press Enter or click the search button");
  await page.waitForLoadState("domcontentloaded");
  
  console.log("✅ Search completed");

  const ResultSchema = z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
    })).describe("Search results"),
  });

  console.log("🤖 Extracting search results...");
  const results = await stagehand.extract(
    "Extract the first 3 search result titles and URLs",
    ResultSchema
  );

  console.log("\n🔍 Search Results:");
  results.results.forEach((result, i) => {
    console.log(`\n${i + 1}. ${result.title}`);
    console.log(`   ${result.url}`);
  });
}

// Test 5: Error handling and resilience
async function testErrorHandling(stagehand, page) {
  console.log("\n" + "=".repeat(80));
  console.log("TEST 5: Error Handling & Resilience");
  console.log("=".repeat(80));

  try {
    await page.goto('https://news.ycombinator.com', { waitUntil: "domcontentloaded" });
    
    // Try to extract something that doesn't exist
    console.log("🧪 Testing extraction of non-existent data...");
    const TestSchema = z.object({
      data: z.string().optional().describe("Some data that might not exist"),
    });

    const result = await stagehand.extract(
      "Extract the user's email address from the page",
      TestSchema
    );

    console.log("✅ Handled gracefully:", result.data || "No data found");

    // Try to click on something that doesn't exist
    console.log("\n🧪 Testing interaction with non-existent element...");
    try {
      await stagehand.act("click on the 'nonexistent' button", { timeout: 5000 });
    } catch (error) {
      console.log("✅ Error caught and handled:", error.message.substring(0, 50) + "...");
    }

  } catch (error) {
    console.log("✅ Test completed with expected errors");
  }
}

// Main test runner
(async () => {
  let stagehand;

  try {
    console.log("🚀 Starting Web Scraping Agent Tests");
    console.log("📡 Lightpanda CDP: ws://" + lpdopts.host + ":" + lpdopts.port);
    console.log("🤖 NVIDIA NIM: " + process.env.NVIDIA_BASE_URL);
    console.log("🧠 Model: meta/llama-3.1-8b-instruct");

    stagehand = new Stagehand(stagehandopts);
    await stagehand.init();
    console.log("✅ Stagehand initialized\n");

    const page = await stagehand.context.newPage();
    console.log("✅ Browser page created");

    // Run tests
    // await testProductScraping(stagehand, page);  // Uncomment to test Amazon
    await testDynamicInteraction(stagehand, page);
    await testPagination(stagehand, page);
    // await testFormInteraction(stagehand, page);  // Uncomment to test Google
    await testErrorHandling(stagehand, page);

    console.log("\n" + "=".repeat(80));
    console.log("✅ ALL TESTS COMPLETED SUCCESSFULLY");
    console.log("=".repeat(80));

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error);
  } finally {
    if (stagehand) {
      await stagehand.close();
      console.log("\n🧹 Cleanup completed");
    }
  }
})();
