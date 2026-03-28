'use strict';

import { Stagehand, tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import readline from 'readline';
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

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    prompt: null,
    format: 1,
    maxSteps: 25,
    totalBooks: 40,
    booksPerChunk: 20,
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
    } else if (arg === '--total' || arg === '-t') {
      parsed.totalBooks = parseInt(args[i + 1]) || 40;
      i++;
    } else if (arg === '--chunk' || arg === '-c') {
      parsed.booksPerChunk = parseInt(args[i + 1]) || 20;
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
║   🤖 AUTONOMOUS SCRAPER WITH LIGHTPANDA (CHUNKED)             ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node autonomous_scraper_lightpanda_chunked.js [OPTIONS]

OPTIONS:
  -p, --prompt <text>     Search prompt/task
  -t, --total <number>    Total books to scrape (default: 40)
  -c, --chunk <number>    Books per chunk (default: 20)
  -s, --steps <number>    Max steps per chunk (default: 25)
  -h, --help              Show this help message

FEATURES:
  • Scrapes in chunks to prevent CDP timeout
  • Saves intermediate results
  • Automatic retry on failure
  • Combines all chunks at the end

EXAMPLES:
  # Scrape 40 books in chunks of 20
  node autonomous_scraper_lightpanda_chunked.js \\
    --prompt "Scrape books from booktoscrape.com" \\
    --total 40 \\
    --chunk 20

  # Scrape 60 books in chunks of 15
  node autonomous_scraper_lightpanda_chunked.js \\
    -p "Scrape books" \\
    -t 60 \\
    -c 15
  `);
}

// Define schemas
const BooksSchema = z.object({
  books: z.array(z.object({
    title: z.string().describe("Book title"),
    price: z.string().describe("Book price"),
    rating: z.string().optional().describe("Book rating"),
    availability: z.string().describe("Availability status"),
  })).describe("Extracted books with all details")
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

// Scrape a single chunk
async function scrapeChunk(chunkNumber, booksPerChunk, maxSteps) {
  let stagehand;
  
  try {
    log(`\n📦 Starting chunk ${chunkNumber}...`, "bright");
    
    // Check Lightpanda
    try {
      const response = await fetch('http://127.0.0.1:9222/json/version');
      if (!response.ok) throw new Error('Lightpanda not responding');
    } catch (error) {
      throw new Error('Lightpanda is not running! Start it with: ./lightpanda serve --host 127.0.0.1 --port 9222');
    }
    
    // Initialize Stagehand
    stagehand = new Stagehand({
      env: "LOCAL",
      model: "azure/gpt-4o-mini",
      verbose: 0,
      experimental: true,
      disableAPI: true,
      keepAlive: true,
      localBrowserLaunchOptions: {
        cdpUrl: "ws://127.0.0.1:9222",
      },
    });

    await stagehand.init();
    const page = await stagehand.context.newPage();
    
    // Create agent
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",
      systemPrompt: `You are a fast, efficient book scraper.
      
TASK: Extract exactly ${booksPerChunk} books from booktoscrape.com page ${chunkNumber}.

RULES:
- Go directly to booktoscrape.com
- Navigate to page ${chunkNumber} if needed
- Extract ${booksPerChunk} books with title, price, and availability
- Be fast and efficient
- Return complete data`,
      stream: false,
    });
    
    // Execute
    const result = await agent.execute({
      instruction: `Go to booktoscrape.com page ${chunkNumber} and extract ${booksPerChunk} books with title, price, and availability`,
      page: page,
      maxSteps: maxSteps,
      output: BooksSchema,
      tools: {
        duckduckgoSearch: duckduckgoSearchTool,
      },
    });
    
    await stagehand.close();
    
    if (result.completed && result.output && result.output.books) {
      log(`✅ Chunk ${chunkNumber}: Extracted ${result.output.books.length} books`, "green");
      return result.output.books;
    } else {
      log(`⚠️  Chunk ${chunkNumber}: Task did not complete`, "yellow");
      return [];
    }
    
  } catch (error) {
    log(`❌ Chunk ${chunkNumber} error: ${error.message}`, "red");
    return [];
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

// Main function
async function runChunkedScraper() {
  console.clear();
  log("╔════════════════════════════════════════════════════════════════╗", "cyan");
  log("║   🤖 AUTONOMOUS SCRAPER WITH LIGHTPANDA (CHUNKED) 🚀          ║", "cyan");
  log("║                  Powered by Stagehand v3.0                    ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════╝", "cyan");
  log("\n✨ Features:", "bright");
  log("  • Chunk-based scraping (prevents CDP timeout)", "green");
  log("  • Automatic retry on failure", "green");
  log("  • Saves intermediate results", "green");
  log("  • Combines all chunks at the end\n", "green");

  const cliArgs = parseArgs();
  
  const totalBooks = cliArgs.totalBooks;
  const booksPerChunk = cliArgs.booksPerChunk;
  const maxSteps = cliArgs.maxSteps;
  const totalChunks = Math.ceil(totalBooks / booksPerChunk);
  
  log("=".repeat(70), "cyan");
  log("🚀 STARTING CHUNKED SCRAPER", "bright");
  log("=".repeat(70), "cyan");
  log(`📊 Total books to scrape: ${totalBooks}`, "yellow");
  log(`📦 Books per chunk: ${booksPerChunk}`, "yellow");
  log(`🔢 Total chunks: ${totalChunks}`, "yellow");
  log(`⏱️  Max steps per chunk: ${maxSteps}`, "yellow");
  log(`🌐 Browser: Lightpanda (CDP on ws://127.0.0.1:9222)\n`, "yellow");

  const allBooks = [];
  const chunkFiles = [];
  
  for (let i = 0; i < totalChunks; i++) {
    const chunkNumber = i + 1;
    let retries = 0;
    const maxRetries = 3;
    let chunkBooks = [];
    
    while (retries < maxRetries) {
      try {
        chunkBooks = await scrapeChunk(chunkNumber, booksPerChunk, maxSteps);
        
        if (chunkBooks.length > 0) {
          // Save chunk
          const chunkFile = `chunk_${chunkNumber}_${Date.now()}.json`;
          fs.writeFileSync(chunkFile, JSON.stringify(chunkBooks, null, 2));
          chunkFiles.push(chunkFile);
          log(`💾 Saved chunk ${chunkNumber} to: ${chunkFile}`, "green");
          
          allBooks.push(...chunkBooks);
          break;  // Success!
        } else {
          throw new Error('No books extracted');
        }
        
      } catch (error) {
        retries++;
        log(`⚠️  Chunk ${chunkNumber} attempt ${retries} failed: ${error.message}`, "yellow");
        
        if (retries >= maxRetries) {
          log(`❌ Skipping chunk ${chunkNumber} after ${maxRetries} attempts`, "red");
          break;
        }
        
        // Wait before retry
        log(`⏳ Waiting 3 seconds before retry...`, "yellow");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Small delay between chunks
    if (i < totalChunks - 1) {
      log(`⏳ Waiting 2 seconds before next chunk...\n`, "gray");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Final results
  log("\n" + "=".repeat(70), "cyan");
  log("✅ SCRAPING COMPLETE", "bright");
  log("=".repeat(70), "cyan");
  log(`📈 Total books scraped: ${allBooks.length}/${totalBooks}`, "green");
  log(`📦 Chunks processed: ${chunkFiles.length}/${totalChunks}`, "green");
  
  if (allBooks.length > 0) {
    // Save combined results
    const finalFile = `lightpanda_books_chunked_${Date.now()}.json`;
    const finalData = {
      timestamp: new Date().toISOString(),
      totalBooks: allBooks.length,
      targetBooks: totalBooks,
      chunksProcessed: chunkFiles.length,
      totalChunks: totalChunks,
      booksPerChunk: booksPerChunk,
      browser: "Lightpanda (CDP)",
      model: "azure/gpt-4o-mini",
      chunkFiles: chunkFiles,
      books: allBooks,
    };
    
    fs.writeFileSync(finalFile, JSON.stringify(finalData, null, 2));
    log(`\n💾 Final results saved to: ${finalFile}`, "green");
    
    // Show sample
    log("\n📊 Sample of scraped books:", "bright");
    allBooks.slice(0, 5).forEach((book, i) => {
      log(`  ${i + 1}. ${book.title} - ${book.price}`, "blue");
    });
    if (allBooks.length > 5) {
      log(`  ... and ${allBooks.length - 5} more`, "gray");
    }
  } else {
    log("\n❌ No books were scraped", "red");
  }
  
  log("\n✅ Done!", "green");
}

// Run scraper
runChunkedScraper().catch(console.error);
