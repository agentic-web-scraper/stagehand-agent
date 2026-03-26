'use strict';

import { Stagehand, tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import fs from 'fs';
import pkg from 'duckduckgo-search';
const { search: duckDuckGoSearch } = pkg;

dotenv.config();

// Rich console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Define schemas
const SearchResultSchema = z.object({
  results: z.array(z.object({
    title: z.string().describe("Title"),
    url: z.string().url().describe("URL"),
    snippet: z.string().describe("Snippet"),
  })).describe("Search results")
});

// Custom DuckDuckGo Search Tool
const duckduckgoSearchTool = tool({
  description: "Search the web using DuckDuckGo search engine",
  parameters: z.object({
    query: z.string().describe("Search query"),
    maxResults: z.number().optional().describe("Maximum number of results (default 10)"),
  }),
  execute: async ({ query, maxResults = 10 }) => {
    try {
      log(`   🔍 Searching DuckDuckGo for: "${query}"`, "blue");
      
      const results = await duckDuckGoSearch({
        query: query,
        max_results: maxResults,
      });

      const formatted = results.map((result) => ({
        title: result.title || "No title",
        url: result.link || "",
        snippet: result.snippet || "No description",
      })).filter(r => r.url);

      log(`   ✅ Found ${formatted.length} results`, "green");
      return formatted;
    } catch (error) {
      log(`   ❌ Search error: ${error.message}`, "red");
      throw error;
    }
  },
});

// Main execution
async function main() {
  let stagehand;

  try {
    // Test parameters
    const userPrompt = "Find the latest JavaScript frameworks and their GitHub repositories";
    const maxSteps = 5;
    const outputFile = `custom_search_results_${Date.now()}.json`;

    // Display header
    log("╔" + "═".repeat(66) + "╗", "cyan");
    log("║   🤖 AUTONOMOUS SCRAPER - TEST MODE (Non-Interactive)         ║", "cyan");
    log("║                  Powered by Stagehand v3.0                    ║", "cyan");
    log("╚" + "═".repeat(66) + "╝", "cyan");

    log("\n📋 TEST CONFIGURATION:", "bright");
    log(`   Query: "${userPrompt}"`, "yellow");
    log(`   Max steps: ${maxSteps}`, "yellow");
    log(`   Output file: ${outputFile}\n`, "yellow");

    log("⏳ Initializing Stagehand...", "bright");
    
    stagehand = new Stagehand({
      env: "LOCAL",
      model: "azure/gpt-4o-mini",
      verbose: 1,
      experimental: true,
      disableAPI: true,
    });

    await stagehand.init();
    log("✅ Stagehand initialized\n", "green");

    log("🧠 Creating agent with custom DuckDuckGo search tool...", "bright");
    
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",
      systemPrompt: `You are an expert web researcher with access to a custom DuckDuckGo search tool.

Your workflow:
1. USE THE TOOL: Call the duckduckgoSearch tool to find relevant information
2. EXTRACT URLs: Get URLs from the search results
3. NAVIGATE: Visit the most relevant URLs
4. EXTRACT DATA: Pull structured information from each page
5. SYNTHESIZE: Combine data from multiple sources

Important:
- Always call duckduckgoSearch first with a clear query
- Visit 2-3 most relevant URLs
- Extract complete and accurate information
- Return well-structured, validated data`,
      stream: false,
    });

    log("✅ Agent created\n", "green");

    log("=" + "=".repeat(69), "cyan");
    log("🔄 EXECUTION IN PROGRESS", "bright");
    log("=" + "=".repeat(69), "cyan");
    log("   [Searching] → [Navigating] → [Extracting]\n", "yellow");

    // Execute agent with custom tools
    const result = await agent.execute({
      instruction: userPrompt,
      maxSteps: maxSteps,
      output: SearchResultSchema,
      tools: {
        duckduckgoSearch: duckduckgoSearchTool,
      },
    });

    log("\n" + "=".repeat(70), "cyan");
    log("✅ EXECUTION COMPLETE", "bright");
    log("=".repeat(70), "cyan\n");

    if (result.completed) {
      log("✨ Task completed successfully!", "green");
      
      const extractedData = result.output;

      if (extractedData) {
        log("\n📊 EXTRACTED DATA:", "bright");
        log("─".repeat(70), "cyan");
        console.log(JSON.stringify(extractedData, null, 2));
        log("─".repeat(70), "cyan");

        // Save results
        const outputData = {
          timestamp: new Date().toISOString(),
          userPrompt: userPrompt,
          outputFormat: "search_results",
          maxSteps: maxSteps,
          completed: result.completed,
          searchTool: "DuckDuckGo (custom)",
          model: "azure/gpt-4o-mini",
          data: extractedData,
        };

        fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
        log(`\n💾 Results saved to: ${outputFile}`, "green");
      }

      // Show agent summary
      if (result.message) {
        log(`\n📝 Agent Summary: ${result.message}`, "magenta");
      }
    } else {
      log("⚠️  Task did not complete", "yellow");
      log(`   Steps taken: ${result.stepsExecuted}`, "yellow");
      if (result.output) {
        log("\n📊 Partial results:", "yellow");
        console.log(JSON.stringify(result.output, null, 2));
      }
    }

    log("\n✅ TEST FINISHED", "green");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    console.error(error);
    process.exit(1);
  } finally {
    if (stagehand) {
      await stagehand.close();
    }
  }
}

main();
