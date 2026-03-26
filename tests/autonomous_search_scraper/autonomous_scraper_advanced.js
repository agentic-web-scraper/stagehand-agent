'use strict';

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import { ScraperConfigs, listConfigs } from './config.js';

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
  gray: '\x1b[90m',
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

// Output schemas
const SearchResultSchema = z.object({
  results: z.array(z.object({
    title: z.string().describe("Title of the search result"),
    url: z.string().url().describe("URL of the search result"),
    snippet: z.string().describe("Brief description/snippet"),
  })).describe("Search results from web")
});

const ArticleSchema = z.object({
  articles: z.array(z.object({
    title: z.string().describe("Article title"),
    url: z.string().url().describe("Article URL"),
    summary: z.string().describe("Article summary"),
    author: z.string().optional().describe("Author name if available"),
  })).describe("Extracted articles")
});

const WebPageDataSchema = z.object({
  title: z.string().describe("Page title"),
  description: z.string().describe("Main content description"),
  data: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).describe("Extracted key-value data")
});

const GenericDataSchema = z.object({
  summary: z.string().describe("Overall summary"),
  items: z.array(z.record(z.string(), z.string())).describe("Extracted items")
});

// Display welcome and config selection
function showWelcome() {
  console.clear();
  log("╔════════════════════════════════════════════════════════════════╗", "cyan");
  log("║   🤖 AUTONOMOUS WEB SCRAPER WITH BRAVE SEARCH (ADVANCED) 🔍   ║", "cyan");
  log("║                  Powered by Stagehand v3.0                    ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════╝", "cyan");
}

// Show available configs
function showConfigs() {
  log("\n🎯 SELECT RESEARCH MODE:", "bright");
  const configs = listConfigs();
  configs.forEach((config, i) => {
    log(`   ${i + 1}. ${config.name.padEnd(12)} - ${config.description} (max ${config.maxSteps} steps)`, "blue");
  });
}

// Main advanced scraper function
async function runAdvancedScraper() {
  showWelcome();
  showConfigs();

  let stagehand;

  try {
    // Get config selection
    const configChoice = await question(
      log("\n📋 Select mode (1-" + listConfigs().length + ", or press Enter for default): ", "magenta") || "1"
    );

    const configs = listConfigs();
    const selectedConfigName = configs[parseInt(configChoice) - 1]?.name || 'default';
    const selectedConfig = ScraperConfigs[selectedConfigName];

    log(`\n✅ Selected mode: ${selectedConfigName.toUpperCase()}`, "green");
    log(`   Description: ${selectedConfig.description}`, "gray");

    // Get user prompt
    const userPrompt = await question(
      log("\n🎯 What would you like to research? \n   > ", "magenta") || ""
    );

    if (!userPrompt.trim()) {
      log("❌ Empty prompt. Exiting.", "red");
      rl.close();
      return;
    }

    // Ask for output format preference
    log("\n📊 Choose output format:", "bright");
    log("  1. Search Results (default)", "blue");
    log("  2. Articles with Summaries", "blue");
    log("  3. Structured Page Data", "blue");
    log("  4. Generic Data Format", "blue");
    
    const formatChoice = await question(
      log("   Select (1-4): ", "magenta") || "1"
    );

    let selectedSchema = SearchResultSchema;
    let outputFile = `search_results_${Date.now()}.json`;

    switch (formatChoice) {
      case "2":
        selectedSchema = ArticleSchema;
        outputFile = `articles_${Date.now()}.json`;
        break;
      case "3":
        selectedSchema = WebPageDataSchema;
        outputFile = `webpage_data_${Date.now()}.json`;
        break;
      case "4":
        selectedSchema = GenericDataSchema;
        outputFile = `generic_data_${Date.now()}.json`;
        break;
    }

    // Ask for step override
    const stepsInput = await question(
      log(`⏱️  Max steps (default ${selectedConfig.maxSteps}): `, "magenta") || String(selectedConfig.maxSteps)
    );
    const maxSteps = parseInt(stepsInput) || selectedConfig.maxSteps;

    rl.close();

    // Display execution summary
    log("\n" + "=".repeat(70), "cyan");
    log("🚀 STARTING AUTONOMOUS RESEARCH", "bright");
    log("=".repeat(70), "cyan");
    log(`📝 Task: "${userPrompt}"`, "yellow");
    log(`🎯 Mode: ${selectedConfigName.toUpperCase()}`, "yellow");
    log(`⏱️  Max steps: ${maxSteps}`, "yellow");
    log(`💾 Output file: ${outputFile}`, "yellow");
    log("🔍 Search tool: Brave Search (built-in)", "yellow");
    log("🧠 Model: Azure OpenAI GPT-4o mini\n", "yellow");

    log("⏳ Initializing Stagehand...", "bright");
    
    stagehand = new Stagehand({
      env: "LOCAL",
      model: selectedConfig.model,
      verbose: 1,
      experimental: true,
      disableAPI: true,
    });

    await stagehand.init();
    log("✅ Stagehand initialized\n", "green");

    log("🧠 Creating agent with custom configuration...", "bright");
    
    const agent = stagehand.agent({
      model: selectedConfig.model,
      systemPrompt: selectedConfig.systemPrompt,
      stream: false,
    });

    log("✅ Agent ready with Brave Search enabled\n", "green");

    // Show execution progress
    log("=" + "=".repeat(69), "cyan");
    log("🔄 EXECUTION IN PROGRESS", "bright");
    log("=" + "=".repeat(69), "cyan");
    log("   [Searching] → [Navigating] → [Extracting] → [Processing]\n", "yellow");

    // Execute agent
    const result = await agent.execute({
      instruction: userPrompt,
      useSearch: selectedConfig.useSearch,
      maxSteps: maxSteps,
      output: selectedSchema,
    });

    log("\n" + "=".repeat(70), "cyan");
    log("✅ RESEARCH COMPLETE", "bright");
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
          mode: selectedConfigName,
          userPrompt: userPrompt,
          outputFormat: formatChoice,
          maxSteps: maxSteps,
          completed: result.completed,
          data: extractedData,
          metadata: {
            model: selectedConfig.model,
            searchEnabled: selectedConfig.useSearch,
            systemPrompt: selectedConfig.systemPrompt.substring(0, 100) + "..."
          }
        };

        fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
        log(`\n💾 Results saved to: ${outputFile}`, "green");
      }

      // Show summary
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
    log(`  • Mode: ${selectedConfigName}`, "blue");
    log(`  • Steps taken: ${result.steps || 'N/A'}`, "blue");
    log(`  • Completed: ${result.completed ? 'Yes' : 'No'}`, "blue");
    log(`  • Model: ${selectedConfig.model}`, "blue");
    log(`  • Search tool: Brave Search (built-in)`, "blue");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    if (stagehand) {
      log("\n🔌 Closing browser session...", "yellow");
      await stagehand.close();
      log("✅ Session closed", "green");
    }
  }
}

// Run scraper
runAdvancedScraper().catch(console.error);
