'use strict';

import { Stagehand, tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

console.log("🤖 Azure OpenAI Scraper with Custom Tools");
console.log("=" + "=".repeat(79));
console.log("☁️  Powered by Azure OpenAI (GPT-4o mini)");
console.log("🛠️  Enhanced with custom tools for data processing");
console.log("=" + "=".repeat(79) + "\n");

// Create readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Define custom tools for the agent
const customTools = {
  // Tool 1: Filter data by criteria
  filterData: tool({
    description: "Filter extracted data by specific criteria (e.g., price range, rating threshold)",
    parameters: z.object({
      items: z.array(z.record(z.string(), z.any())).describe("Array of items to filter"),
      filterField: z.string().describe("Field name to filter by"),
      filterValue: z.any().describe("Value to filter for"),
      operator: z.enum(["equals", "contains", "greaterThan", "lessThan", "startsWith"]).describe("Filter operator"),
    }),
    execute: async ({ items, filterField, filterValue, operator }) => {
      const filtered = items.filter(item => {
        const fieldValue = item[filterField];
        switch (operator) {
          case "equals":
            return fieldValue === filterValue;
          case "contains":
            return String(fieldValue).includes(String(filterValue));
          case "greaterThan":
            return Number(fieldValue) > Number(filterValue);
          case "lessThan":
            return Number(fieldValue) < Number(filterValue);
          case "startsWith":
            return String(fieldValue).startsWith(String(filterValue));
          default:
            return false;
        }
      });
      return {
        originalCount: items.length,
        filteredCount: filtered.length,
        items: filtered,
      };
    },
  }),

  // Tool 2: Sort data
  sortData: tool({
    description: "Sort extracted data by a specific field",
    parameters: z.object({
      items: z.array(z.record(z.string(), z.any())).describe("Array of items to sort"),
      sortField: z.string().describe("Field name to sort by"),
      order: z.enum(["ascending", "descending"]).describe("Sort order"),
    }),
    execute: async ({ items, sortField, order }) => {
      const sorted = [...items].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        // Handle numeric values
        if (!isNaN(aVal) && !isNaN(bVal)) {
          return order === "ascending" ? aVal - bVal : bVal - aVal;
        }
        
        // Handle string values
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return order === "ascending" 
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
      
      return {
        sortedBy: sortField,
        order: order,
        items: sorted,
      };
    },
  }),

  // Tool 3: Deduplicate data
  deduplicateData: tool({
    description: "Remove duplicate items from extracted data based on a unique field",
    parameters: z.object({
      items: z.array(z.record(z.string(), z.any())).describe("Array of items to deduplicate"),
      uniqueField: z.string().describe("Field to use for uniqueness check"),
    }),
    execute: async ({ items, uniqueField }) => {
      const seen = new Set();
      const deduplicated = [];
      
      items.forEach(item => {
        const value = item[uniqueField];
        if (!seen.has(value)) {
          seen.add(value);
          deduplicated.push(item);
        }
      });
      
      return {
        originalCount: items.length,
        deduplicatedCount: deduplicated.length,
        duplicatesRemoved: items.length - deduplicated.length,
        items: deduplicated,
      };
    },
  }),

  // Tool 4: Extract specific fields
  extractFields: tool({
    description: "Extract only specific fields from each item",
    parameters: z.object({
      items: z.array(z.record(z.string(), z.any())).describe("Array of items"),
      fields: z.array(z.string()).describe("Field names to extract"),
    }),
    execute: async ({ items, fields }) => {
      const extracted = items.map(item => {
        const newItem = {};
        fields.forEach(field => {
          if (field in item) {
            newItem[field] = item[field];
          }
        });
        return newItem;
      });
      
      return {
        itemsProcessed: items.length,
        fieldsExtracted: fields,
        items: extracted,
      };
    },
  }),

  // Tool 5: Get statistics
  getStatistics: tool({
    description: "Calculate statistics on numeric fields",
    parameters: z.object({
      items: z.array(z.record(z.string(), z.any())).describe("Array of items"),
      field: z.string().describe("Numeric field to analyze"),
    }),
    execute: async ({ items, field }) => {
      const values = items
        .map(item => Number(item[field]))
        .filter(v => !isNaN(v));
      
      if (values.length === 0) {
        return { error: "No numeric values found" };
      }
      
      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
      
      return {
        field,
        count: values.length,
        sum: sum.toFixed(2),
        average: avg.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2),
        median: median.toFixed(2),
      };
    },
  }),
};

(async () => {
  let stagehand;

  try {
    // Get task from user
    const userTask = await question("💬 What do you want to scrape?\n   → ");
    
    if (!userTask) {
      console.log("❌ Please provide a task description");
      rl.close();
      return;
    }

    // Ask about data processing
    const needsProcessing = await question("\n🛠️  Do you want to process the data? (filter/sort/deduplicate/etc) (yes/no): ");
    
    // Ask about pagination
    const needsPagination = await question("\n📄 Do you need pagination? (yes/no): ");
    const maxPages = needsPagination.toLowerCase().startsWith('y') 
      ? parseInt(await question("   How many pages? (default 3): ") || "3")
      : 1;

    // Ask about max steps
    const maxSteps = parseInt(await question("\n🎯 Max steps for agent? (default 100): ") || "100");

    console.log("\n" + "=".repeat(80));
    console.log("📋 TASK SUMMARY");
    console.log("=".repeat(80));
    console.log(`💬 Task: ${userTask}`);
    console.log(`🛠️  Data Processing: ${needsProcessing.toLowerCase().startsWith('y') ? 'Yes' : 'No'}`);
    console.log(`📄 Pages: ${maxPages}`);
    console.log(`🎯 Max steps: ${maxSteps}`);
    console.log("=".repeat(80) + "\n");

    const confirm = await question("▶️  Start scraping? (yes/no): ");
    if (!confirm.toLowerCase().startsWith('y')) {
      console.log("❌ Cancelled");
      rl.close();
      return;
    }

    rl.close(); // Close readline before starting browser

    console.log("\n🚀 Initializing Stagehand with Azure OpenAI...");
    
    stagehand = new Stagehand({
      env: "LOCAL",
      localBrowserLaunchOptions: {
        headless: false,
        viewport: { width: 1280, height: 720 },
      },
      model: "azure/gpt-4o-mini",
      verbose: 2,
      experimental: true,
      disableAPI: true,
    });

    await stagehand.init();
    console.log("✅ Agent initialized with custom tools\n");
    
    const page = stagehand.context.pages()[0];
    
    // Start from Google
    console.log("🌐 Starting from Google...");
    await page.goto('https://www.google.com', { waitUntil: "domcontentloaded" });
    console.log("✅ Ready to search\n");

    console.log("=" + "=".repeat(79));
    console.log("🧠 AGENT STARTING WITH CUSTOM TOOLS");
    console.log("=" + "=".repeat(79) + "\n");

    // Build system prompt
    const systemPrompt = `You are an expert autonomous web scraping agent with advanced data processing capabilities.

CORE ABILITIES:
1. SEARCH: Use Google to find the right website
2. NAVIGATE: Click on search results and navigate
3. OBSERVE: Analyze webpage structure
4. EXTRACT: Pull structured data
${maxPages > 1 ? `5. PAGINATE: Navigate through up to ${maxPages} pages` : ''}

CUSTOM TOOLS AVAILABLE:
- filterData: Filter items by criteria (equals, contains, greaterThan, lessThan, startsWith)
- sortData: Sort items by field (ascending/descending)
- deduplicateData: Remove duplicates based on unique field
- extractFields: Extract only specific fields from items
- getStatistics: Calculate statistics on numeric fields (count, sum, avg, min, max, median)

${needsProcessing.toLowerCase().startsWith('y') ? `DATA PROCESSING:
After extracting data, use the custom tools to:
- Filter out unwanted items
- Sort by relevance or value
- Remove duplicates
- Extract only needed fields
- Calculate statistics if needed` : ''}

CURRENT TASK: ${userTask}

Remember: Search first, scrape second, then process the data!`;

    // Create agent with custom tools
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",
      systemPrompt: systemPrompt,
      mode: "dom",
      tools: customTools,
    });

    // Define output schema
    const OutputSchema = z.object({
      searchQuery: z.string().describe("The search query used"),
      targetWebsite: z.string().describe("The website URL"),
      rawData: z.array(z.record(z.string(), z.any())).describe("Raw extracted data"),
      processedData: z.array(z.record(z.string(), z.any())).describe("Processed data after filtering/sorting"),
      totalItems: z.number().describe("Total items extracted"),
      processedItems: z.number().describe("Items after processing"),
      strategy: z.string().describe("Extraction and processing strategy"),
      summary: z.string().describe("Summary of accomplishments"),
      completionStatus: z.enum(["complete", "partial", "failed"]).describe("Task status"),
    });

    console.log("🎯 Agent executing with custom tools...\n");
    
    const instruction = maxPages > 1
      ? `${userTask}. Search Google, navigate to the website, extract data from up to ${maxPages} pages.${needsProcessing.toLowerCase().startsWith('y') ? ' Then use custom tools to process the data (filter, sort, deduplicate, etc).' : ''}`
      : `${userTask}. Search Google, navigate to the website, extract data.${needsProcessing.toLowerCase().startsWith('y') ? ' Then use custom tools to process the data (filter, sort, deduplicate, etc).' : ''}`;

    const result = await agent.execute({
      instruction: instruction,
      maxSteps: maxSteps,
      output: OutputSchema,
      highlightCursor: true,
    });

    console.log("\n" + "=".repeat(80));
    console.log("✅ AGENT COMPLETED");
    console.log("=".repeat(80) + "\n");

    if (result.output) {
      console.log("📊 RESULTS:");
      console.log("-".repeat(80));
      console.log(`🔍 Search Query: "${result.output.searchQuery}"`);
      console.log(`🌐 Target Website: ${result.output.targetWebsite}`);
      console.log(`📰 Raw Items: ${result.output.totalItems}`);
      console.log(`🛠️  Processed Items: ${result.output.processedItems}`);
      console.log(`🎯 Strategy: ${result.output.strategy}`);
      console.log(`📝 Summary: ${result.output.summary}`);
      console.log(`✅ Status: ${result.output.completionStatus.toUpperCase()}`);
      
      console.log("\n🎯 Processed Data (first 15):");
      console.log("-".repeat(80));
      
      const dataArray = Array.isArray(result.output.processedData) 
        ? result.output.processedData 
        : [];
      
      dataArray.slice(0, 15).forEach((item, i) => {
        console.log(`\n${i + 1}.`);
        Object.entries(item).slice(0, 4).forEach(([key, value]) => {
          const displayValue = typeof value === 'string' && value.length > 60 
            ? value.substring(0, 60) + "..." 
            : value;
          console.log(`   ${key}: ${displayValue}`);
        });
      });

      if (dataArray.length > 15) {
        console.log(`\n... and ${dataArray.length - 15} more items`);
      }

      // Save results
      const fs = await import('fs/promises');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `scraper-with-tools-${timestamp}.json`;
      
      const output = {
        task: userTask,
        searchQuery: result.output.searchQuery,
        targetWebsite: result.output.targetWebsite,
        timestamp: new Date().toISOString(),
        model: "Azure OpenAI GPT-4o mini",
        customToolsUsed: Object.keys(customTools),
        result: result.output,
      };
      
      await fs.writeFile(filename, JSON.stringify(output, null, 2));
      console.log(`\n💾 Results saved to: ${filename}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("🎉 Scraping with custom tools completed!");
    console.log("🛠️  Custom tools used: filterData, sortData, deduplicateData, extractFields, getStatistics");
    console.log("=".repeat(80));

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.stack) {
      console.error("\n📋 Stack trace:");
      console.error(error.stack);
    }
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
        console.log("\n🧹 Browser closed");
      } catch (e) {
        // Ignore close errors
      }
    }
  }
})();
