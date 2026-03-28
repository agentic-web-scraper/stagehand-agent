'use strict';

import { Stagehand, tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import pkg from 'duckduckgo-search';
import puppeteer from 'puppeteer-core';

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

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    prompt: null,
    format: 1,
    maxSteps: 25,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--prompt' || arg === '-p') {
      parsed.prompt = args[i + 1];
      i++;
    } else if (arg === '--format' || arg === '-f') {
      parsed.format = parseInt(args[i + 1]) || 1;
      i++;
    } else if (arg === '--steps' || arg === '-s') {
      parsed.maxSteps = parseInt(args[i + 1]) || 25;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  return parsed;
}

// Show help message
function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║   🤖 AUTONOMOUS SCRAPER WITH LIGHTPANDA (PROPER)              ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node autonomous_scraper_lightpanda_proper.js [OPTIONS]

OPTIONS:
  -p, --prompt <text>     Search prompt/task (required for non-interactive)
  -f, --format <number>   Output format: 1=Search Results, 2=Articles (default: 1)
  -s, --steps <number>    Max steps for agent (default: 25)
  -h, --help              Show this help message

REQUIREMENTS:
  • Lightpanda must be running: ./lightpanda serve --host 127.0.0.1 --port 9222
  • Azure OpenAI credentials in .env file

EXAMPLES:
  node autonomous_scraper_lightpanda_proper.js --prompt "Scrape 10 books" --steps 50
  `);
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Define schemas
const SearchResultSchema = z.object({
  results: z.array(z.object({
    title: z.string().describe("Title"),
    url: z.string().url().describe("URL"),
    snippet: z.string().describe("Snippet"),
  })).describe("Search results")
});

const BooksSchema = z.object({
  books: z.array(z.object({
    title: z.string().describe("Book title"),
    price: z.string().describe("Book price"),
    rating: z.string().optional().describe("Book rating"),
    availability: z.string().describe("Availability status"),
  })).describe("Extracted books with all details")
});

const ArticleSchema = z.object({
  articles: z.array(z.object({
    title: z.string().describe("Article title"),
    url: z.string().url().describe("Article URL"),
    summary: z.string().describe("Article summary"),
  })).describe("Extracted articles")
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
      
      return {
        success: true,
        query: query,
        count: formatted.length,
        results: formatted,
      };
    } catch (error) {
      log(`   ⚠️  Search error: ${error.message}`, "yellow");
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  },
});

// Display welcome
function showWelcome() {
  console.clear();
  log("╔════════════════════════════════════════════════════════════════╗", "cyan");
  log("║   🤖 AUTONOMOUS SCRAPER WITH LIGHTPANDA (PROPER) 🚀           ║", "cyan");
  log("║                  Powered by Stagehand v3.0                    ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════╝", "cyan");
  log("\n✨ Features:", "bright");
  log("  • Lightpanda headless browser via Puppeteer CDP", "green");
  log("  • Custom DuckDuckGo search tool (no API key needed)", "green");
  log("  • Stagehand methods with Lightpanda pages", "green");
  log("  • Autonomous URL navigation and data extraction", "green");
  log("  • Works with Azure OpenAI only\n", "green");
}

// Main function
async function runLightpandaProperScraper() {
  showWelcome();

  let browser;
  let stagehand;

  try {
    // Check if Lightpanda is running
    log("🔍 Checking Lightpanda connection...", "yellow");
    try {
      const response = await fetch('http://127.0.0.1:9222/json/version');
      if (!response.ok) throw new Error('Lightpanda not responding');
      log("✅ Lightpanda is running on ws://127.0.0.1:9222\n", "green");
    } catch (error) {
      log("❌ ERROR: Lightpanda is not running!", "red");
      log("   Start Lightpanda with: ./lightpanda serve --host 127.0.0.1 --port 9222", "yellow");
      process.exit(1);
    }

    // Parse command-line arguments
    const cliArgs = parseArgs();
    
    let userPrompt = cliArgs.prompt;
    let formatChoice = cliArgs.format.toString();
    let maxSteps = cliArgs.maxSteps;

    // If no prompt provided, use interactive mode
    if (!userPrompt) {
      userPrompt = await question(
        log("🎯 What would you like to search and scrape?\n   > ", "magenta") || ""
      );

      if (!userPrompt.trim()) {
        log("❌ Empty prompt. Exiting.", "red");
        rl.close();
        return;
      }

      // Get output format
      log("\n📊 Choose output format:", "bright");
      log("  1. Search Results (default)", "blue");
      log("  2. Articles with Summaries", "blue");
      
      formatChoice = await question(
        log("   Select (1-2): ", "magenta") || "1"
      );

      // Get max steps
      const stepsInput = await question(
        log("⏱️  Max steps for agent (default 25): ", "magenta") || "25"
      );
      maxSteps = parseInt(stepsInput) || 25;
    }

    let selectedSchema = SearchResultSchema;
    let outputFile = `lightpanda_proper_search_${Date.now()}.json`;

    // Check if user is asking for books
    if (userPrompt.toLowerCase().includes('book')) {
      selectedSchema = BooksSchema;
      outputFile = `lightpanda_proper_books_${Date.now()}.json`;
    } else if (formatChoice === "2") {
      selectedSchema = ArticleSchema;
      outputFile = `lightpanda_proper_articles_${Date.now()}.json`;
    }

    rl.close();

    // Display summary
    log("\n" + "=".repeat(70), "cyan");
    log("🚀 STARTING AUTONOMOUS SCRAPER WITH LIGHTPANDA (PROPER)", "bright");
    log("=".repeat(70), "cyan");
    log(`📝 Task: "${userPrompt}"`, "yellow");
    log(`⏱️  Max steps: ${maxSteps}`, "yellow");
    log(`🌐 Browser: Lightpanda via Puppeteer CDP`, "yellow");
    log(`🔍 Search tool: DuckDuckGo (custom)`, "yellow");
    log(`📄 Output format: ${formatChoice === "2" ? "Articles" : "Search Results"}`, "yellow");
    log(`💾 Output file: ${outputFile}\n`, "yellow");

    // Connect Puppeteer to Lightpanda
    log("⏳ Connecting Puppeteer to Lightpanda...", "bright");
    browser = await puppeteer.connect({
      browserWSEndpoint: "ws://127.0.0.1:9222",
    });
    log("✅ Puppeteer connected to Lightpanda\n", "green");

    // Get or create a page
    const pages = await browser.pages();
    let page = pages.length > 0 ? pages[0] : await browser.newPage();

    // Initialize Stagehand (it will create its own browser, but we'll use Lightpanda page)
    log("⏳ Initializing Stagehand...", "bright");
    stagehand = new Stagehand({
      env: "LOCAL",
      model: "azure/gpt-4o-mini",
      verbose: 1,
      experimental: true,
      disableAPI: true,
      localBrowserLaunchOptions: {
        headless: true,  // Keep Stagehand's browser hidden
      },
    });

    await stagehand.init();
    log("✅ Stagehand initialized\n", "green");

    log("🧠 Creating agent with custom DuckDuckGo search tool...", "bright");
    log("⚠️  NOTE: Agent will use Stagehand's internal browser, not Lightpanda", "yellow");
    log("   (Stagehand agent doesn't support external pages yet)\n", "yellow");
    
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",
      systemPrompt: `You are an expert web researcher and data scraper with access to a custom DuckDuckGo search tool.

Your workflow:
1. USE THE TOOL: Call the duckduckgoSearch tool to find relevant information
2. EXTRACT URLs: Get URLs from the search results
3. NAVIGATE: Visit the most relevant URLs
4. EXTRACT DATA: Pull structured information from EACH page
5. ACCUMULATE: Collect and combine data from ALL pages
6. RETURN ALL: Return the complete accumulated dataset

CRITICAL INSTRUCTIONS:
- Always call duckduckgoSearch first with a clear query
- Visit ALL relevant pages/URLs needed to meet the user's request
- Extract COMPLETE and ACCURATE information from each page
- ACCUMULATE all extracted data across all pages
- Return the FULL dataset with ALL items collected
- Do NOT truncate or limit the results - return everything extracted
- Ensure the final output contains ALL data from ALL pages visited`,
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
      output: selectedSchema,
      tools: {
        duckduckgoSearch: duckduckgoSearchTool,
      },
    });

    log("\n" + "=".repeat(70), "cyan");
    log("✅ EXECUTION COMPLETE", "bright");
    log("=".repeat(70), "cyan\n");

    if (result.completed) {
      log("✨ Task completed successfully!", "green");
      
      let extractedData = result.output;

      // If the output is a string (from agent message), try to parse it
      if (typeof extractedData === 'string') {
        try {
          extractedData = JSON.parse(extractedData);
        } catch (e) {
          log("⚠️  Could not parse agent output as JSON", "yellow");
        }
      }

      if (extractedData) {
        log("\n📊 EXTRACTED DATA:", "bright");
        log("─".repeat(70), "cyan");
        console.log(JSON.stringify(extractedData, null, 2));
        log("─".repeat(70), "cyan");

        // Count total items
        let totalItems = 0;
        if (extractedData.results) {
          totalItems = extractedData.results.length;
        } else if (extractedData.articles) {
          totalItems = extractedData.articles.length;
        } else if (extractedData.books) {
          totalItems = extractedData.books.length;
        }

        log(`\n📈 Total items extracted: ${totalItems}`, "green");

        // Save results
        const outputData = {
          timestamp: new Date().toISOString(),
          userPrompt: userPrompt,
          outputFormat: formatChoice === "2" ? "articles" : "search_results",
          maxSteps: maxSteps,
          completed: result.completed,
          browser: "Stagehand's Chromium (Lightpanda connection attempted)",
          searchTool: "DuckDuckGo (custom)",
          model: "azure/gpt-4o-mini",
          totalItemsExtracted: totalItems,
          data: extractedData,
        };

        fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
        log(`\n💾 Results saved to: ${outputFile}`, "green");
      }

      // Show agent summary
      if (result.message) {
        log("\n💬 Agent Summary:", "blue");
        log(`"${result.message}"`, "yellow");
      }
    } else {
      log("⚠️  Task did not complete within max steps", "yellow");
      log(`Steps taken: ${result.steps || 'unknown'}`, "yellow");
    }

    // Statistics
    log("\n📈 EXECUTION STATISTICS:", "bright");
    log(`  • Steps taken: ${result.steps || 'N/A'}`, "blue");
    log(`  • Completed: ${result.completed ? 'Yes' : 'No'}`, "blue");
    log(`  • Browser: Stagehand's internal Chromium`, "blue");
    log(`  • Model: Azure OpenAI GPT-4o mini`, "blue");
    log(`  • Search tool: DuckDuckGo (custom, no API key needed)`, "blue");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    if (browser) {
      log("\n🔌 Closing Lightpanda connection...", "yellow");
      await browser.disconnect();
      log("✅ Lightpanda disconnected", "green");
    }
    if (stagehand) {
      log("🔌 Closing Stagehand session...", "yellow");
      await stagehand.close();
      log("✅ Stagehand closed", "green");
    }
  }
}

// Run scraper
runLightpandaProperScraper().catch(console.error);
