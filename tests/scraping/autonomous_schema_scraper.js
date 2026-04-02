'use strict';

import { Stagehand, tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import fs from 'fs';
import { searchUrls } from '../lib/searchUrls.js';
import { 
  generateCssSchema, 
  extractWithSchemaAndConfidence,
  getCachedSchema 
} from '../lib/generateSchemaUtil.js';

dotenv.config();

// Rich console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// SearXNG Search Tool
const searxngSearchTool = tool({
  description: "Search the web using SearXNG to find relevant URLs. Returns a list of search results with titles, URLs, and snippets.",
  inputSchema: z.object({
    query: z.string().describe("The search query string"),
    maxResults: z.number().optional().describe("Maximum number of search results to return"),
  }),
  execute: async ({ query, maxResults }) => {
    try {
      const numResults = maxResults || 10;
      log(`   🔍 Searching SearXNG for: "${query}"`, "blue");
      
      const result = await searchUrls(query, numResults);

      if (!result.success) {
        log(`   ⚠️  Search error: ${result.error}`, "yellow");
        return {
          success: false,
          error: result.error,
          results: [],
        };
      }

      log(`   ✅ Found ${result.count} results`, "green");
      
      return result;
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

// Schema Generation Tool Factory
function createSchemaGenerationTool(page) {
  return tool({
    description: "Generate a CSS extraction schema for pages with repeating patterns (e-commerce, listings, etc.). Use this for cost-effective extraction when the same pattern appears multiple times. Returns schema with confidence score.",
    inputSchema: z.object({
      query: z.string().describe("What data to extract (e.g., 'Extract products with title, price, rating')"),
    }),
    execute: async ({ query }) => {
      try {
        log(`   🤖 Generating CSS schema for: "${query}"`, "blue");
        
        const url = page.url();
        const domain = new URL(url).hostname;
        
        // Check cache first
        const cachedSchema = await getCachedSchema(domain);
        if (cachedSchema) {
          log(`   ♻️  Using cached schema (instant, $0)`, "green");
          return {
            success: true,
            schema: cachedSchema,
            cached: true,
            confidence: cachedSchema.confidence,
            message: `Schema loaded from cache. Confidence: ${(cachedSchema.confidence * 100).toFixed(1)}%`
          };
        }
        
        // Capture page structure
        const { formattedTree } = await page.snapshot();
        const html = await page.evaluate(() => document.documentElement.outerHTML);
        
        // Generate schema
        const schema = await generateCssSchema(formattedTree, html, query, url);
        
        log(`   ✅ Schema generated! Confidence: ${(schema.confidence * 100).toFixed(1)}%`, "green");
        
        return {
          success: true,
          schema,
          cached: false,
          confidence: schema.confidence,
          itemsFound: schema.validation.itemsFound,
          message: `Schema generated with ${schema.fields.length} fields. Confidence: ${(schema.confidence * 100).toFixed(1)}%. Found ${schema.validation.itemsFound} items in sample.`
        };
      } catch (error) {
        log(`   ❌ Schema generation failed: ${error.message}`, "red");
        return {
          success: false,
          error: error.message,
          message: `Failed to generate schema: ${error.message}`
        };
      }
    },
  });
}

// Schema Extraction Tool Factory
function createSchemaExtractionTool(page) {
  return tool({
    description: "Extract data using a previously generated CSS schema. Very fast and cost-effective (no LLM calls). Use after generating schema with generateSchema tool.",
    inputSchema: z.object({
      schema: z.any().describe("The CSS schema object from generateSchema tool"),
    }),
    execute: async ({ schema }) => {
      try {
        log(`   ⚡ Extracting data with CSS schema...`, "blue");
        
        const result = await extractWithSchemaAndConfidence(page, schema);
        
        log(`   ✅ Extracted ${result.itemCount} items (confidence: ${(result.finalConfidence * 100).toFixed(1)}%)`, "green");
        
        return {
          success: true,
          items: result.items,
          count: result.itemCount,
          confidence: result.finalConfidence,
          message: `Successfully extracted ${result.itemCount} items. Confidence: ${(result.finalConfidence * 100).toFixed(1)}%`
        };
      } catch (error) {
        log(`   ❌ Extraction failed: ${error.message}`, "red");
        return {
          success: false,
          error: error.message,
          items: [],
          count: 0,
          message: `Failed to extract data: ${error.message}`
        };
      }
    },
  });
}

// Page Analysis Tool
function createPageAnalysisTool(page) {
  return tool({
    description: "Analyze if the current page has repeating patterns suitable for schema-based extraction. Returns recommendation on whether to use schema extraction or LLM extraction.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        log(`   🔍 Analyzing page structure...`, "blue");
        
        const analysis = await page.evaluate(() => {
          // Count repeating elements
          const selectors = [
            'article',
            '.product',
            '.item',
            '[class*="product"]',
            '[class*="item"]',
            'li[class*="list"]',
            'div[class*="card"]',
            'tr[class*="row"]'
          ];
          
          let maxRepeating = 0;
          let bestSelector = null;
          
          for (const selector of selectors) {
            try {
              const elements = document.querySelectorAll(selector);
              if (elements.length > maxRepeating) {
                maxRepeating = elements.length;
                bestSelector = selector;
              }
            } catch (e) {
              // Invalid selector, skip
            }
          }
          
          // Check for pagination
          const paginationSelectors = [
            'a[href*="page"]',
            'a[href*="?p="]',
            '.pagination',
            '[class*="pag"]',
            'a[rel="next"]'
          ];
          
          let hasPagination = false;
          for (const selector of paginationSelectors) {
            if (document.querySelector(selector)) {
              hasPagination = true;
              break;
            }
          }
          
          return {
            repeatingCount: maxRepeating,
            bestSelector,
            hasPagination,
            url: window.location.href
          };
        });
        
        // Determine recommendation
        const useSchema = analysis.repeatingCount >= 5;
        const reason = useSchema 
          ? `Found ${analysis.repeatingCount} repeating elements (${analysis.bestSelector}). Schema extraction recommended for cost efficiency.`
          : `Only ${analysis.repeatingCount} repeating elements found. LLM extraction recommended for better accuracy.`;
        
        log(`   ${useSchema ? '✅' : '⚠️'} ${reason}`, useSchema ? "green" : "yellow");
        
        return {
          success: true,
          useSchema,
          repeatingCount: analysis.repeatingCount,
          bestSelector: analysis.bestSelector,
          hasPagination: analysis.hasPagination,
          reason,
          message: reason
        };
      } catch (error) {
        log(`   ⚠️  Analysis failed: ${error.message}`, "yellow");
        return {
          success: false,
          useSchema: false,
          reason: `Analysis failed: ${error.message}. Defaulting to LLM extraction.`,
          message: `Could not analyze page. Use LLM extraction.`
        };
      }
    },
  });
}

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    url: null,
    prompt: null,
    maxSteps: 50,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--url' || arg === '-u') {
      parsed.url = args[i + 1];
      i++;
    } else if (arg === '--prompt' || arg === '-p') {
      parsed.prompt = args[i + 1];
      i++;
    } else if (arg === '--steps' || arg === '-s') {
      parsed.maxSteps = parseInt(args[i + 1]) || 50;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  return parsed;
}

function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║   🤖 FULLY AUTONOMOUS AGENT: AI Makes All Decisions           ║
║              With SearXNG Search Integration                  ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node fully_autonomous_agent.js [OPTIONS]

OPTIONS:
  -p, --prompt <text>       What you want to find/scrape (required)
  -u, --url <url>           Specific URL to scrape (optional)
  -s, --steps <number>      Max steps for agent (default: 50)
  -h, --help                Show this help message

FEATURES:
  • Agent makes ALL decisions autonomously
  • SearXNG search to find relevant URLs
  • Intelligent extraction strategy selection
  • Schema-based extraction for cost efficiency
  • LLM extraction for complex pages
  • Automatic caching and reuse
  • Works without knowing the URL beforehand

REQUIREMENTS:
  • SearXNG instance running (default: http://localhost:8888)
  • Set SEARXNG_URL environment variable if using different instance

EXAMPLES:
  # Search and scrape (no URL needed)
  node fully_autonomous_agent.js \\
    --prompt "Find and scrape Python tutorial websites"

  # Search for specific information
  node fully_autonomous_agent.js \\
    -p "Find the top 5 React documentation sites and extract their main topics"

  # Direct URL scraping (traditional mode)
  node fully_autonomous_agent.js \\
    --url "http://books.toscrape.com" \\
    --prompt "Scrape all books with titles and prices"

  # Search with more steps
  node fully_autonomous_agent.js \\
    -p "Find JavaScript frameworks and compare their features" \\
    -s 100
  `);
}

// Generic schema for any data
const GenericDataSchema = z.object({
  items: z.array(z.record(z.string(), z.any())),
});

// Main fully autonomous agent
async function fullyAutonomousAgent() {
 
  const args = parseArgs();
  
  if (!args.prompt) {
    log("\n❌ Error: Prompt is required", "red");
    log("   Use: --prompt \"what to find/scrape\"", "yellow");
    process.exit(1);
  }
  
  log("\n" + "=".repeat(70), "cyan");
  log("🚀 STARTING FULLY AUTONOMOUS AGENT", "bright");
  log("=".repeat(70), "cyan");
  log(`📝 Task: ${args.prompt}`, "yellow");
  log(`🌐 URL: ${args.url || 'Will search with SearXNG'}`, "yellow");
  log(`⏱️  Max steps: ${args.maxSteps}`, "yellow");
  log(`🤖 Mode: Fully Autonomous (Agent makes all decisions)`, "yellow");
  log(`🔍 Search: SearXNG (if no URL provided)`, "yellow");
  log(`🌐 Browser: Chromium (built-in)\n`, "yellow");

  let stagehand;
  
  try {
    // Initialize Stagehand
    log("⏳ Initializing Stagehand...", "bright");
    stagehand = new Stagehand({
      env: "LOCAL",
      model: "azure/gpt-4o-mini",
      verbose: 1,  // Show agent's thinking
      headless: false,
      experimental: true,  // Required for agent output schema
      disableAPI: true,    // Required for experimental features
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];
    log("✅ Stagehand initialized\n", "green");

    // Navigate to URL if provided
    if (args.url) {
      log("⏳ Navigating to URL...", "yellow");
      await page.goto(args.url, { waitUntil: 'networkidle' });
      log("✅ Page loaded\n", "green");
    } else {
      log("ℹ️  No URL provided - agent will use SearXNG search\n", "blue");
    }

    // Create autonomous agent with intelligent extraction tools
    log("🤖 Creating autonomous agent with intelligent extraction...", "blue");
    
    const tools = {
      analyzePage: createPageAnalysisTool(page),
      generateSchema: createSchemaGenerationTool(page),
      extractWithSchema: createSchemaExtractionTool(page),
    };
    
    // Add search tool if no URL provided
    if (!args.url) {
      tools.searxngSearch = searxngSearchTool;
    }
    
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",
      mode: "dom",
      tools,
      systemPrompt: args.url 
        ? `You are an expert web scraper with intelligent extraction capabilities.

AVAILABLE TOOLS:
1. analyzePage - Analyze if page has repeating patterns (e-commerce, listings, etc.)
2. generateSchema - Generate CSS schema for cost-effective extraction
3. extractWithSchema - Extract data using schema (fast, no LLM cost)

INTELLIGENT EXTRACTION WORKFLOW:
1. ANALYZE: Call analyzePage to check if page has repeating patterns
2. DECIDE:
   - If useSchema=true (5+ repeating items): Use schema-based extraction
     a. Call generateSchema with clear query (e.g., "Extract products with title, price, rating")
     b. Call extractWithSchema with the generated schema
     c. Schema is cached - reuse for pagination/similar pages
   - If useSchema=false (complex page): Use built-in extract() for LLM extraction
3. EXTRACT: Get all data from current page and ACCUMULATE in your memory
4. PAGINATE: If more pages needed and pagination exists:
   - Use act() to click next button
   - Call extractWithSchema again (reuse same schema - instant!)
   - ACCUMULATE items from each page
5. RETURN: ALL accumulated items in {items: [...]} format

CRITICAL RULES:
- ALWAYS call analyzePage first to make intelligent decision
- For e-commerce/listings: MUST use schema extraction
- Schema is cached by domain - instant reuse
- ACCUMULATE all items from all pages before returning
- Return format: {items: [{title: "...", price: "...", rating: "..."}, ...]}
- Each extractWithSchema call returns items - ADD them to your collection
- Stop when you have enough items OR no more pages
- If extractWithSchema returns items (even with 50%+ confidence), DO NOT call extract() again
- Only use LLM extract() if schema extraction returns 0 items
- Schema extraction is sufficient for e-commerce sites

EXAMPLE WORKFLOW:
1. analyzePage → useSchema=true
2. generateSchema → get schema
3. extractWithSchema → get 20 items (page 1)
4. act("click next") → go to page 2
5. extractWithSchema → get 20 items (page 2) - ADD to collection
6. act("click next") → go to page 3
7. extractWithSchema → get 20 items (page 3) - ADD to collection
8. Continue until target reached
9. Return {items: [all 60+ items]}`
        : `You are an expert web researcher and data scraper with intelligent extraction capabilities.

AVAILABLE TOOLS:
1. searxngSearch - Search the web for relevant URLs
2. analyzePage - Analyze if page has repeating patterns
3. generateSchema - Generate CSS schema for cost-effective extraction
4. extractWithSchema - Extract data using schema (fast, no LLM cost)

INTELLIGENT SEARCH & EXTRACTION WORKFLOW:
1. SEARCH: Call searxngSearch with your query (NEVER navigate to search engines manually)
2. NAVIGATE: Use goto to visit relevant URLs from search results
3. ANALYZE: Call analyzePage to check page structure
4. EXTRACT:
   - If useSchema=true: Use generateSchema + extractWithSchema (cost-effective)
   - If useSchema=false: Use built-in extract() (LLM extraction)
5. REPEAT: Visit multiple URLs if needed
6. RETURN: All data in {items: [...]} format

COST OPTIMIZATION:
- Schema extraction: $0.002 first time, $0 cached
- LLM extraction: Costs per page
- Prefer schema for e-commerce, listings, repeated patterns

CRITICAL RULES:
- NEVER navigate to google.com, bing.com, or search engines
- ALWAYS use searxngSearch TOOL first
- ALWAYS call analyzePage before extraction
- Use schema extraction when recommended
- Return structured data: {items: [{...}, {...}]}`,
    });
    log("✅ Agent created with intelligent extraction tools\n", "green");

    // Execute agent
    // log("╔════════════════════════════════════════════════════════════════╗", "cyan");
    // log("║ 🤖 AGENT EXECUTING AUTONOMOUSLY                                ║", "cyan");
    // log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    // log("💭 Agent is thinking and making decisions...", "blue");
    // if (!args.url) {
    //   log("   The agent will:", "gray");
    //   log("   • Search DuckDuckGo for relevant URLs", "gray");
    //   log("   • Visit the most relevant sites", "gray");
    //   log("   • Extract the requested data", "gray");
    //   log("   • Decide when to stop\n", "gray");
    // } else {
    //   log("   The agent will:", "gray");
    //   log("   • Understand what data to extract", "gray");
    //   log("   • Navigate through pages if needed", "gray");
    //   log("   • Decide when to stop", "gray");
    //   log("   • Extract all relevant data\n", "gray");
    // }

    const startTime = Date.now();
    
    const result = await agent.execute({
      instruction: args.prompt,
      output: GenericDataSchema,
      maxSteps: args.maxSteps,
    });
    
    const duration = Date.now() - startTime;

    // Check results
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ ✅ AGENT EXECUTION COMPLETE                                    ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    // Extract items - handle nested structure
    let items = [];
    if (result.output?.items) {
      items = result.output.items;
    } else if (result.output?.books) {
      items = result.output.books;
    } else if (Array.isArray(result.output)) {
      items = result.output;
    }
    
    if (items.length === 0) {
      log("⚠️  No items extracted", "yellow");
      log("   The agent may need more steps or a clearer prompt", "gray");
    } else {
      log(`✅ Agent extracted ${items.length} items`, "green");
      log(`⏱️  Total time: ${Math.round(duration / 1000)}s`, "gray");
      log(`📊 Steps taken: ${result.steps || 'unknown'}`, "gray");
    }

    // Save results
    const outputFile = `results/autonomous_agent_${Date.now()}.json`;
    const outputData = {
      timestamp: new Date().toISOString(),
      url: args.url || "Search-based (SearXNG)",
      prompt: args.prompt,
      method: "Fully Autonomous Agent with Intelligent Extraction",
      features: {
        searchEnabled: !args.url,
        searchTool: !args.url ? "SearXNG" : "N/A",
        intelligentExtraction: true,
        schemaGeneration: true,
        costOptimization: true,
      },
      browser: "Chromium",
      model: "azure/gpt-4o-mini",
      maxSteps: args.maxSteps,
      stepsTaken: result.steps || 'unknown',
      completed: result.completed || false,
      totalItems: items.length,
      executionTime: `${Math.round(duration / 1000)}s`,
      items: items,
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    
    log(`\n💾 Results saved to: ${outputFile}`, "green");
    
    // Show sample
    if (items.length > 0) {
      log("\n📊 Sample of extracted items:", "bright");
      items.slice(0, 5).forEach((item, i) => {
        // Handle both object and string items
        let preview;
        if (typeof item === 'object' && item !== null) {
          preview = Object.entries(item)
            .map(([k, v]) => `${k}: ${String(v).substring(0, 50)}`)
            .join(', ');
        } else {
          preview = String(item).substring(0, 100);
        }
        log(`  ${i + 1}. ${preview}`, "blue");
      });
      if (items.length > 5) {
        log(`  ... and ${items.length - 5} more`, "gray");
      }
    }
    
    log("\n✅ Done!", "green");
    log("💡 The agent made all decisions autonomously!", "yellow");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    console.error(error.stack);
  } finally {
    if (stagehand) {
      await stagehand.close();
    }
  }
}

// Run agent
fullyAutonomousAgent().catch(console.error);
