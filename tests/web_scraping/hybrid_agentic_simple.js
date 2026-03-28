'use strict';

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import fs from 'fs';

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

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    url: null,
    pages: 3,
    prompt: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--url' || arg === '-u') {
      parsed.url = args[i + 1];
      i++;
    } else if (arg === '--pages' || arg === '-p') {
      parsed.pages = parseInt(args[i + 1]) || 3;
      i++;
    } else if (arg === '--prompt') {
      parsed.prompt = args[i + 1];
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
║   🎯 HYBRID AGENTIC SCRAPER: Autonomous Multi-Page Extraction  ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node hybrid_agentic_simple.js [OPTIONS]

OPTIONS:
  -u, --url <url>         Website URL to scrape (required)
  -p, --pages <number>    Number of pages to scrape (default: 3)
  --prompt <text>         What to scrape (e.g., "books")
  -h, --help              Show this help message

FEATURES:
  • Fully autonomous agent-based scraping
  • Multi-page navigation
  • Works on any website
  • Structured data extraction

EXAMPLES:
  # Scrape books
  node hybrid_agentic_simple.js \\
    --url "http://books.toscrape.com" \\
    --pages 3 \\
    --prompt "books"

  # Scrape products
  node hybrid_agentic_simple.js \\
    -u "https://example.com/products" \\
    -p 5 \\
    --prompt "products"
  `);
}

// Generic item schema
const ItemSchema = z.object({
  items: z.array(z.object({
    title: z.string(),
    price: z.string().optional(),
    availability: z.string().optional(),
    rating: z.string().optional(),
  })),
});

// Main hybrid agentic scraper
async function hybridAgenticScraper() {
  console.clear();
  log("╔════════════════════════════════════════════════════════════════╗", "cyan");
  log("║   🎯 HYBRID AGENTIC SCRAPER: Autonomous Multi-Page Extraction ║", "cyan");
  log("║                    Fully Autonomous Agent                     ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════╝", "cyan");
  
  const args = parseArgs();
  
  if (!args.url) {
    log("\n❌ Error: URL is required", "red");
    log("   Use: --url <url>", "yellow");
    process.exit(1);
  }

  const itemType = args.prompt || "items";
  
  log("\n" + "=".repeat(70), "cyan");
  log("🚀 STARTING HYBRID AGENTIC SCRAPER", "bright");
  log("=".repeat(70), "cyan");
  log(`🌐 URL: ${args.url}`, "yellow");
  log(`📄 Pages to scrape: ${args.pages}`, "yellow");
  log(`📝 Scraping: ${itemType}`, "yellow");
  log(`🔧 Method: Agent-based extraction`, "yellow");
  log(`🌐 Browser: Chromium (built-in)\n`, "yellow");

  let stagehand;
  
  try {
    // Initialize Stagehand
    log("⏳ Initializing Stagehand...", "bright");
    stagehand = new Stagehand({
      env: "LOCAL",
      model: "azure/gpt-4o-mini",
      verbose: 0,
      headless: true,
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];
    log("✅ Stagehand initialized\n", "green");

    // Navigate to first page
    log("⏳ Navigating to first page...", "yellow");
    await page.goto(args.url, { waitUntil: 'networkidle' });
    log("✅ Page loaded\n", "green");

    const allItems = [];
    let totalExtractionTime = 0;
    
    for (let pageNum = 1; pageNum <= args.pages; pageNum++) {
      log(`📄 Page ${pageNum}/${args.pages}`, 'bright');
      log(`   URL: ${page.url()}`, 'blue');
      
      const startTime = Date.now();
      
      // Extract data
      log('   🔍 Extracting data...', 'blue');
      const result = await stagehand.extract({
        instruction: `Extract all ${itemType} from this page. For each ${itemType}, get the title, price (if available), availability (if available), and rating (if available).`,
        schema: ItemSchema,
      });
      
      const duration = Date.now() - startTime;
      totalExtractionTime += duration;
      
      if (!result || !result.items || result.items.length === 0) {
        log(`   ⚠️  No items found`, 'yellow');
        break;
      }
      
      allItems.push(...result.items);
      log(`   ✅ Extracted ${result.items.length} items in ${duration}ms`, 'green');
      log(`   📈 Total items: ${allItems.length}\n`, 'green');
      
      // Navigate to next page
      if (pageNum < args.pages) {
        try {
          log('   ➡️  Navigating to next page...', 'blue');
          
          await stagehand.act({
            action: "click the next page button or link",
          });
          
          // Wait for navigation
          await new Promise(r => setTimeout(r, 2000));
          log('   ✅ Navigated to next page\n', 'green');
        } catch (error) {
          log(`   ℹ️  No more pages\n`, 'gray');
          break;
        }
      }
    }

    // Save results
    log("=".repeat(70), "cyan");
    log("✅ SCRAPING COMPLETE", "bright");
    log("=".repeat(70), "cyan");
    
    const outputFile = `hybrid_agentic_${Date.now()}.json`;
    const outputData = {
      timestamp: new Date().toISOString(),
      url: args.url,
      itemType: itemType,
      method: "Hybrid Agentic (Agent extraction + navigation)",
      browser: "Chromium",
      pagesScraped: Math.min(args.pages, Math.ceil(allItems.length / 20)),
      totalItems: allItems.length,
      totalExtractionTime: `${totalExtractionTime}ms`,
      avgTimePerPage: `${Math.round(totalExtractionTime / Math.min(args.pages, Math.ceil(allItems.length / 20)))}ms`,
      items: allItems,
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    
    log(`\n📊 Results:`, 'bright');
    log(`   Total items: ${allItems.length}`, 'green');
    log(`   Pages scraped: ${Math.ceil(allItems.length / 20)}`, 'green');
    log(`   Total extraction time: ${totalExtractionTime}ms`, 'green');
    log(`   Avg time per page: ${Math.round(totalExtractionTime / Math.ceil(allItems.length / 20))}ms`, 'green');
    
    log(`\n💾 Results saved to: ${outputFile}`, 'green');
    
    // Show sample
    log("\n📊 Sample of scraped items:", "bright");
    allItems.slice(0, 5).forEach((item, i) => {
      log(`  ${i + 1}. ${item.title} - ${item.price || 'N/A'}`, "blue");
    });
    if (allItems.length > 5) {
      log(`  ... and ${allItems.length - 5} more`, "gray");
    }
    
    log("\n✅ Done!", "green");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    console.error(error.stack);
  } finally {
    if (stagehand) {
      await stagehand.close();
    }
  }
}

// Run scraper
hybridAgenticScraper().catch(console.error);
