'use strict';

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';

dotenv.config();

// Rich console output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Create readline interface for interactive prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Define schemas for different extraction types
const SearchResultSchema = z.object({
  results: z.array(z.object({
    title: z.string().describe("Title of the search result"),
    url: z.string().url().describe("URL of the search result"),
    snippet: z.string().describe("Brief description/snippet"),
  })).describe("Search results from web")
});

const WebPageDataSchema = z.object({
  title: z.string().describe("Page title"),
  description: z.string().describe("Main content description"),
  data: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).describe("Extracted key-value data")
});

const ArticleSchema = z.object({
  articles: z.array(z.object({
    title: z.string().describe("Article title"),
    url: z.string().url().describe("Article URL"),
    summary: z.string().describe("Article summary"),
    author: z.string().optional().describe("Author name if available"),
  })).describe("Extracted articles")
});

// Display welcome message
function showWelcome() {
  console.clear();
  log("╔════════════════════════════════════════════════════════════════╗", "cyan");
  log("║   🤖 AUTONOMOUS WEB SCRAPER WITH BRAVE SEARCH AGENT 🔍        ║", "cyan");
  log("║                  Powered by Stagehand v3.0                    ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════╝", "cyan");
  log("\n📋 This agent will:", "bright");
  log("  1. Search the web using Brave Search (built-in)", "green");
  log("  2. Navigate to relevant URLs", "green");
  log("  3. Extract structured data based on your task", "green");
  log("  4. Stream real-time progress to you\n", "green");
}

// Show task examples
function showExamples() {
  log("💡 Example tasks you can ask:", "yellow");
  log("  • 'Search for latest AI frameworks and extract their URLs'", "blue");
  log("  • 'Find top 5 machine learning articles and summarize them'", "blue");
  log("  • 'Search for web scraping tools and get their features'", "blue");
  log("  • 'Find the latest Node.js updates and extract release notes'", "blue");
  log("  • 'Search for Stagehand competitors and extract their pricing'\n", "blue");
}

// Main autonomous scraper function
async function runAutonomousScraper() {
  showWelcome();
  showExamples();

  let stagehand;

  try {
    // Get user prompt
    const userPrompt = await question(
      log("🎯 What would you like to search and scrape? \n   > ", "magenta") || ""
    );

    if (!userPrompt.trim()) {
      log("❌ Empty prompt. Exiting.", "red");
      rl.close();
      return;
    }

    // Ask for output format preference
    log("\n📊 Choose output format:", "bright");
    log("  1. Search Results (default)", "blue");
    log("  2. Articles/Blog Posts", "blue");
    log("  3. General Web Page Data", "blue");
    
    const formatChoice = await question(
      log("   Select (1-3): ", "magenta") || "1"
    );

    let selectedSchema = SearchResultSchema;
    let outputFile = `search_results_${Date.now()}.json`;

    if (formatChoice === "2") {
      selectedSchema = ArticleSchema;
      outputFile = `articles_${Date.now()}.json`;
    } else if (formatChoice === "3") {
      selectedSchema = WebPageDataSchema;
      outputFile = `webpage_data_${Date.now()}.json`;
    }

    // Ask for max steps
    const maxStepsInput = await question(
      log("⏱️  Max steps for agent (default 30): ", "magenta") || "30"
    );
    const maxSteps = parseInt(maxStepsInput) || 30;

    rl.close();

    log("\n" + "=".repeat(70), "cyan");
    log("🚀 STARTING AUTONOMOUS SCRAPER", "bright");
    log("=".repeat(70), "cyan");
    log(`📝 Task: "${userPrompt}"`, "yellow");
    log(`🎯 Max steps: ${maxSteps}`, "yellow");
    log(`📄 Output format: ${formatChoice === "2" ? "Articles" : formatChoice === "3" ? "Web Page Data" : "Search Results"}`, "yellow");
    log(`💾 Output file: ${outputFile}\n`, "yellow");

    log("⏳ Initializing Stagehand with Azure OpenAI...", "bright");
    
    stagehand = new Stagehand({
      env: "LOCAL",
      model: "azure/gpt-4o-mini",
      verbose: 1,
      experimental: true,
      disableAPI: true,
    });

    await stagehand.init();
    log("✅ Stagehand initialized\n", "green");

    log("🧠 Creating autonomous agent with search capabilities...", "bright");
    
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",
      systemPrompt: `You are an expert web researcher and data extraction agent. 
      
Your abilities:
1. SEARCH: Use web search to find relevant information
2. NAVIGATE: Visit URLs and analyze their content
3. EXTRACT: Pull structured data from web pages
4. VALIDATE: Verify extracted data quality
5. SYNTHESIZE: Combine data from multiple sources

Guidelines:
- Always search first using the web search tool
- Prioritize relevance and data quality
- Extract complete and accurate information
- Visit multiple pages if needed to get comprehensive results
- Return well-structured data`,
      stream: false,
    });

    log("✅ Agent created with Brave Search enabled\n", "green");

    log("=" + "=".repeat(69), "cyan");
    log("🔄 AGENT EXECUTION IN PROGRESS", "bright");
    log("=" + "=".repeat(69), "cyan");
    log("   Searching web → Navigating URLs → Extracting data...\n", "yellow");

    // Execute agent with web search enabled
    const result = await agent.execute({
      instruction: userPrompt,
      useSearch: true, // Enable built-in Brave Search
      maxSteps: maxSteps,
      output: selectedSchema,
    });

    log("\n" + "=".repeat(70), "cyan");
    log("✅ SCRAPING COMPLETE", "bright");
    log("=".repeat(70), "cyan\n");

    if (result.completed) {
      log("✨ Task completed successfully!", "green");
      
      // Extract output
      const extractedData = result.output;

      if (extractedData) {
        log("\n📊 EXTRACTED DATA:", "bright");
        log("─".repeat(70), "cyan");
        console.log(JSON.stringify(extractedData, null, 2));
        log("─".repeat(70), "cyan");

        // Save to file
        fs.writeFileSync(
          outputFile,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            userPrompt: userPrompt,
            maxSteps: maxSteps,
            completed: result.completed,
            data: extractedData,
          }, null, 2)
        );

        log(`\n💾 Results saved to: ${outputFile}`, "green");
      }

      // Show agent message
      if (result.message) {
        log("\n💬 Agent Summary:", "blue");
        log(`"${result.message}"`, "yellow");
      }
    } else {
      log("⚠️  Task did not complete within max steps", "yellow");
      log(`Steps taken: ${result.steps || 'unknown'}`, "yellow");
    }

    // Show statistics
    log("\n📈 EXECUTION STATISTICS:", "bright");
    log(`  • Steps taken: ${result.steps || 'N/A'}`, "blue");
    log(`  • Completed: ${result.completed ? 'Yes' : 'No'}`, "blue");
    log(`  • Model: Azure OpenAI GPT-4o mini`, "blue");
    log(`  • Search tool: Brave Search (built-in)`, "blue");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, "red");
    }
  } finally {
    if (stagehand) {
      log("\n🔌 Closing browser session...", "yellow");
      await stagehand.close();
      log("✅ Session closed", "green");
    }
  }
}

// Run the scraper
runAutonomousScraper().catch(console.error);
