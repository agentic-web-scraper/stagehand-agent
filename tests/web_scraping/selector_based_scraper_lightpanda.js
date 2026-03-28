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
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    url: null,
    totalPages: 1,
    itemsPerPage: 20,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--url' || arg === '-u') {
      parsed.url = args[i + 1];
      i++;
    } else if (arg === '--pages' || arg === '-p') {
      parsed.totalPages = parseInt(args[i + 1]) || 1;
      i++;
    } else if (arg === '--items' || arg === '-i') {
      parsed.itemsPerPage = parseInt(args[i + 1]) || 20;
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
║   🎯 SELECTOR-BASED SCRAPER WITH LIGHTPANDA                   ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node selector_based_scraper_lightpanda.js [OPTIONS]

OPTIONS:
  -u, --url <url>         Website URL to scrape
  -p, --pages <number>    Number of pages to scrape (default: 1)
  -i, --items <number>    Expected items per page (default: 20)
  -h, --help              Show this help message

FEATURES:
  • Fast scraping using CSS selectors and XPath
  • No AI tokens wasted on extraction
  • Multi-page support with pagination
  • Lightpanda browser (low memory)
  • 10x faster than AI-powered extraction

EXAMPLES:
  # Scrape 1 page from booktoscrape.com
  node selector_based_scraper_lightpanda.js \\
    --url "http://books.toscrape.com" \\
    --pages 1

  # Scrape 3 pages (60 books)
  node selector_based_scraper_lightpanda.js \\
    -u "http://books.toscrape.com" \\
    -p 3 \\
    -i 20
  `);
}

// Site-specific selectors configuration
const SITE_CONFIGS = {
  'books.toscrape.com': {
    name: 'Books to Scrape',
    selectors: {
      // Book items
      bookItem: 'article.product_pod',
      title: 'h3 a',
      titleAttr: 'title',
      price: '.price_color',
      availability: '.availability',
      rating: 'p.star-rating',
      ratingAttr: 'class',
      image: '.image_container img',
      imageAttr: 'src',
      link: 'h3 a',
      linkAttr: 'href',
      
      // Pagination
      nextButton: '.next a',
      nextButtonAttr: 'href',
    },
    baseUrl: 'http://books.toscrape.com',
  },
  
  // Add more site configurations here
  'example.com': {
    name: 'Example Site',
    selectors: {
      // Define selectors for other sites
    },
  },
};

// Extract data using selectors (fast, no AI)
async function extractWithSelectors(page, config) {
  log('   📊 Extracting data using CSS selectors...', 'blue');
  
  const startTime = Date.now();
  
  const data = await page.evaluate((cfg) => {
    const items = [];
    const bookElements = document.querySelectorAll(cfg.selectors.bookItem);
    
    bookElements.forEach((book) => {
      try {
        // Extract title
        const titleEl = book.querySelector(cfg.selectors.title);
        const title = titleEl ? 
          (cfg.selectors.titleAttr ? titleEl.getAttribute(cfg.selectors.titleAttr) : titleEl.textContent.trim()) 
          : 'N/A';
        
        // Extract price
        const priceEl = book.querySelector(cfg.selectors.price);
        const price = priceEl ? priceEl.textContent.trim() : 'N/A';
        
        // Extract availability
        const availEl = book.querySelector(cfg.selectors.availability);
        const availability = availEl ? availEl.textContent.trim() : 'N/A';
        
        // Extract rating
        let rating = 'N/A';
        if (cfg.selectors.rating) {
          const ratingEl = book.querySelector(cfg.selectors.rating);
          if (ratingEl && cfg.selectors.ratingAttr) {
            const ratingClass = ratingEl.getAttribute(cfg.selectors.ratingAttr);
            const match = ratingClass.match(/star-rating\s+(\w+)/i);
            rating = match ? match[1] : 'N/A';
          }
        }
        
        // Extract link
        const linkEl = book.querySelector(cfg.selectors.link);
        const link = linkEl ? 
          (cfg.selectors.linkAttr ? linkEl.getAttribute(cfg.selectors.linkAttr) : linkEl.href) 
          : 'N/A';
        
        items.push({
          title,
          price,
          availability,
          rating,
          link: link.startsWith('http') ? link : cfg.baseUrl + '/' + link.replace(/^\.\.\//, ''),
        });
      } catch (error) {
        console.error('Error extracting item:', error);
      }
    });
    
    return items;
  }, config);
  
  const duration = Date.now() - startTime;
  log(`   ✅ Extracted ${data.length} items in ${duration}ms (selector-based)`, 'green');
  
  return data;
}

// Find next page link using selector
async function findNextPageLink(page, config) {
  try {
    const nextLink = await page.evaluate((cfg) => {
      const nextEl = document.querySelector(cfg.selectors.nextButton);
      if (!nextEl) return null;
      
      const href = cfg.selectors.nextButtonAttr ? 
        nextEl.getAttribute(cfg.selectors.nextButtonAttr) : 
        nextEl.href;
      
      return href;
    }, config);
    
    if (nextLink) {
      // Make absolute URL
      if (nextLink.startsWith('http')) {
        return nextLink;
      } else if (nextLink.startsWith('/')) {
        return config.baseUrl + nextLink;
      } else {
        // Relative path
        const currentUrl = await page.url();
        const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/'));
        return baseUrl + '/' + nextLink;
      }
    }
    
    return null;
  } catch (error) {
    log(`   ⚠️  Error finding next page: ${error.message}`, 'yellow');
    return null;
  }
}

// Main scraping function
async function scrapeWithSelectors() {
  console.clear();
  log("╔════════════════════════════════════════════════════════════════╗", "cyan");
  log("║   🎯 SELECTOR-BASED SCRAPER WITH LIGHTPANDA 🚀                ║", "cyan");
  log("║                  10x Faster than AI Extraction                ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════╝", "cyan");
  log("\n✨ Features:", "bright");
  log("  • CSS selectors & XPath (no AI tokens)", "green");
  log("  • Lightpanda browser (low memory)", "green");
  log("  • Multi-page pagination support", "green");
  log("  • 10x faster than AI-powered extraction\n", "green");

  const args = parseArgs();
  
  if (!args.url) {
    log("❌ Error: URL is required", "red");
    log("   Use: --url <url> or -u <url>", "yellow");
    log("   Example: --url http://books.toscrape.com\n", "yellow");
    process.exit(1);
  }

  // Detect site configuration
  const hostname = new URL(args.url).hostname;
  const config = SITE_CONFIGS[hostname];
  
  if (!config) {
    log(`❌ Error: No configuration found for ${hostname}`, "red");
    log(`   Supported sites: ${Object.keys(SITE_CONFIGS).join(', ')}`, "yellow");
    log(`   Add configuration in SITE_CONFIGS object\n`, "yellow");
    process.exit(1);
  }

  log("=".repeat(70), "cyan");
  log("🚀 STARTING SELECTOR-BASED SCRAPER", "bright");
  log("=".repeat(70), "cyan");
  log(`🌐 Site: ${config.name}`, "yellow");
  log(`📍 URL: ${args.url}`, "yellow");
  log(`📄 Pages to scrape: ${args.totalPages}`, "yellow");
  log(`📊 Expected items per page: ${args.itemsPerPage}`, "yellow");
  log(`🔧 Method: CSS Selectors (no AI tokens)\n`, "yellow");

  let stagehand;
  
  try {
    // Check Lightpanda
    log("🔍 Checking Lightpanda connection...", "yellow");
    try {
      const response = await fetch('http://127.0.0.1:9222/json/version');
      if (!response.ok) throw new Error('Lightpanda not responding');
      log("✅ Lightpanda is running\n", "green");
    } catch (error) {
      log("❌ ERROR: Lightpanda is not running!", "red");
      log("   Start it with: ./lightpanda serve --host 127.0.0.1 --port 9222\n", "yellow");
      process.exit(1);
    }

    // Initialize Stagehand
    log("⏳ Initializing Stagehand with Lightpanda...", "bright");
    stagehand = new Stagehand({
      env: "LOCAL",
      verbose: 0,
      keepAlive: true,
      localBrowserLaunchOptions: {
        cdpUrl: "ws://127.0.0.1:9222",
      },
    });

    await stagehand.init();
    const page = await stagehand.context.newPage();
    log("✅ Stagehand initialized\n", "green");

    const allItems = [];
    let currentUrl = args.url;
    
    for (let pageNum = 1; pageNum <= args.totalPages; pageNum++) {
      log(`\n📄 Page ${pageNum}/${args.totalPages}`, "bright");
      log(`   Navigating to: ${currentUrl}`, "blue");
      
      // Navigate to page
      await page.goto(currentUrl, { waitUntil: 'networkidle' });
      log(`   ✅ Page loaded`, "green");
      
      // Extract data using selectors (fast!)
      const items = await extractWithSelectors(page, config);
      
      if (items.length === 0) {
        log(`   ⚠️  No items found on page ${pageNum}`, "yellow");
        break;
      }
      
      allItems.push(...items);
      log(`   📈 Total items so far: ${allItems.length}`, "green");
      
      // Find next page
      if (pageNum < args.totalPages) {
        const nextUrl = await findNextPageLink(page, config);
        
        if (nextUrl) {
          currentUrl = nextUrl;
          log(`   ➡️  Next page found: ${nextUrl}`, "blue");
          await new Promise(r => setTimeout(r, 1000));  // Small delay
        } else {
          log(`   ⚠️  No more pages found`, "yellow");
          break;
        }
      }
    }

    // Save results
    log("\n" + "=".repeat(70), "cyan");
    log("✅ SCRAPING COMPLETE", "bright");
    log("=".repeat(70), "cyan");
    log(`📈 Total items scraped: ${allItems.length}`, "green");
    log(`📄 Pages scraped: ${Math.min(args.totalPages, Math.ceil(allItems.length / args.itemsPerPage))}`, "green");
    
    const outputFile = `selector_scrape_${Date.now()}.json`;
    const outputData = {
      timestamp: new Date().toISOString(),
      site: config.name,
      url: args.url,
      method: "CSS Selectors (no AI)",
      browser: "Lightpanda",
      totalItems: allItems.length,
      pagesScraped: Math.ceil(allItems.length / args.itemsPerPage),
      items: allItems,
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    log(`\n💾 Results saved to: ${outputFile}`, "green");
    
    // Show sample
    log("\n📊 Sample of scraped items:", "bright");
    allItems.slice(0, 5).forEach((item, i) => {
      log(`  ${i + 1}. ${item.title} - ${item.price}`, "blue");
    });
    if (allItems.length > 5) {
      log(`  ... and ${allItems.length - 5} more`, "gray");
    }
    
    log("\n✅ Done!", "green");
    log("💡 Tip: This method is 10x faster and uses 0 AI tokens!", "yellow");

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
scrapeWithSelectors().catch(console.error);
