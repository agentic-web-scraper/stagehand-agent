#!/usr/bin/env node
/**
 * Demo: CSS Schema Generator & Scraper
 * 
 * Usage:
 *   node demo_schema_scraper.js <url> <query>
 * 
 * Examples:
 *   node demo_schema_scraper.js "http://books.toscrape.com" "Extract books with title, price, rating"
 *   node demo_schema_scraper.js "https://news.ycombinator.com" "Extract posts with title, url, points"
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { generateCssSchema, extractWithSchema } from '../lib/generateSchemaUtil.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Colors for output
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

function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║   🤖 CSS Schema Generator & Scraper Demo                      ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node demo_schema_scraper.js <url> <query>

ARGUMENTS:
  url     Website URL to scrape
  query   Natural language description of what to extract

EXAMPLES:
  # Books website
  node demo_schema_scraper.js \\
    "http://books.toscrape.com" \\
    "Extract books with title, price, rating, availability"

  # Hacker News
  node demo_schema_scraper.js \\
    "https://news.ycombinator.com" \\
    "Extract posts with title, url, points, author"

  # E-commerce site
  node demo_schema_scraper.js \\
    "https://example.com/products" \\
    "Extract products with name, price, description"

FEATURES:
  ✅ Automatic CSS schema generation using LLM
  ✅ Schema validation & confidence scoring
  ✅ Automatic refinement for low-confidence schemas
  ✅ File-based caching (fast subsequent runs)
  ✅ Data extraction using generated schema
  ✅ Results saved to JSON file

OUTPUT:
  • Generated schema (displayed & cached)
  • Extracted data (displayed & saved to results/)
  • Performance metrics
  `);
}

async function demo(url, query) {
  log('\n' + '='.repeat(70), 'cyan');
  log('🤖 CSS SCHEMA GENERATOR & SCRAPER DEMO', 'bright');
  log('='.repeat(70) + '\n', 'cyan');

  log(`URL: ${url}`, 'yellow');
  log(`Query: ${query}`, 'yellow');
  log('');

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: process.env.STAGEHAND_MODEL || "azure/gpt-4o-mini",
    verbose: 0,
    headless: true,
  });

  try {
    // Initialize
    log('⏳ Initializing browser...', 'gray');
    await stagehand.init();
    log('✅ Browser ready\n', 'green');
    
    const page = stagehand.context.pages()[0];

    // Navigate
    log('🌐 Loading page...', 'gray');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    log('✅ Page loaded\n', 'green');

    // Capture structure
    log('📸 Analyzing page structure...', 'gray');
    const snapshot = await page.snapshot({ includeIframes: false });
    const fullHTML = await page.evaluate(() => document.body.innerHTML);
    const htmlSample = fullHTML.substring(0, 10000);
    log('✅ Structure captured\n', 'green');

    // Generate schema
    log('🤖 Generating CSS schema with LLM...', 'bright');
    log('   (with validation, confidence scoring, and auto-refinement)\n', 'blue');
    
    const schemaStartTime = Date.now();
    
    const schema = await generateCssSchema(
      snapshot.formattedTree,
      htmlSample,
      query,
      page.url()
    );
    
    const schemaTime = Date.now() - schemaStartTime;

    // Display schema
    log('\n' + '='.repeat(70), 'cyan');
    log('📋 GENERATED SCHEMA', 'bright');
    log('='.repeat(70) + '\n', 'cyan');

    log(`Name: ${schema.name}`, 'yellow');
    log(`Base Selector: ${schema.baseSelector}`, 'yellow');
    log(`\nFields (${schema.fields.length}):`, 'yellow');
    schema.fields.forEach((field, i) => {
      log(`  ${i + 1}. ${field.name}`, 'blue');
      log(`     Type: ${field.type}`, 'gray');
      log(`     Selector: ${field.selector}`, 'gray');
      if (field.attribute) log(`     Attribute: ${field.attribute}`, 'gray');
    });
    
    if (schema.pagination && schema.pagination.type !== 'none') {
      log(`\nPagination:`, 'yellow');
      log(`  Type: ${schema.pagination.type}`, 'gray');
      log(`  Pattern: ${schema.pagination.pattern || 'N/A'}`, 'gray');
    }
    
    log(`\nValidation:`, 'yellow');
    log(`  Structure Valid: ${schema.validation.structureValid ? '✅' : '❌'}`, 'blue');
    log(`  Confidence: ${(schema.confidence * 100).toFixed(1)}%`, schema.confidence >= 0.7 ? 'green' : 'yellow');
    log(`  Items Found (in sample): ${schema.validation.itemsFound}`, 'gray');
    log(`  Refinement Attempts: ${schema.metadata.refinementAttempts}`, 'gray');
    log(`  Generation Time: ${(schemaTime / 1000).toFixed(2)}s`, 'gray');

    // Extract data
    log('\n' + '='.repeat(70), 'cyan');
    log('📊 EXTRACTING DATA', 'bright');
    log('='.repeat(70) + '\n', 'cyan');

    const extractStartTime = Date.now();
    const items = await extractWithSchema(page, schema);
    const extractTime = Date.now() - extractStartTime;

    log(`✅ Extracted ${items.length} items in ${(extractTime / 1000).toFixed(2)}s\n`, 'green');

    // Display sample items
    if (items.length > 0) {
      log('📦 Sample Items:\n', 'bright');
      const sampleCount = Math.min(5, items.length);
      
      items.slice(0, sampleCount).forEach((item, i) => {
        log(`${i + 1}. Item ${i + 1}:`, 'yellow');
        Object.entries(item).forEach(([key, value]) => {
          const displayValue = String(value).substring(0, 80);
          log(`   ${key}: ${displayValue}`, 'blue');
        });
        log('');
      });

      if (items.length > sampleCount) {
        log(`... and ${items.length - sampleCount} more items\n`, 'gray');
      }
    } else {
      log('⚠️  No items extracted. Schema may need adjustment.\n', 'yellow');
    }

    // Save results
    const timestamp = Date.now();
    const domain = new URL(url).hostname.replace(/\./g, '_');
    
    // Save schema
    const schemaFile = `results/schema_${domain}_${timestamp}.json`;
    fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2));
    
    // Save extracted data
    const dataFile = `results/data_${domain}_${timestamp}.json`;
    const outputData = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      query: query,
      schema: {
        name: schema.name,
        baseSelector: schema.baseSelector,
        fields: schema.fields,
        pagination: schema.pagination
      },
      metadata: {
        confidence: schema.confidence,
        itemsExtracted: items.length,
        schemaGenerationTime: `${(schemaTime / 1000).toFixed(2)}s`,
        extractionTime: `${(extractTime / 1000).toFixed(2)}s`,
        totalTime: `${((schemaTime + extractTime) / 1000).toFixed(2)}s`,
        refinementAttempts: schema.metadata.refinementAttempts
      },
      extractedData: items
    };
    fs.writeFileSync(dataFile, JSON.stringify(outputData, null, 2));

    // Summary
    log('='.repeat(70), 'cyan');
    log('✅ COMPLETE', 'bright');
    log('='.repeat(70) + '\n', 'cyan');

    log('Summary:', 'yellow');
    log(`  • Items Extracted: ${items.length}`, 'blue');
    log(`  • Confidence: ${(schema.confidence * 100).toFixed(1)}%`, 'blue');
    log(`  • Schema Generation: ${(schemaTime / 1000).toFixed(2)}s`, 'blue');
    log(`  • Data Extraction: ${(extractTime / 1000).toFixed(2)}s`, 'blue');
    log(`  • Total Time: ${((schemaTime + extractTime) / 1000).toFixed(2)}s`, 'blue');
    
    log('\nFiles Saved:', 'yellow');
    log(`  • Schema: ${schemaFile}`, 'green');
    log(`  • Data: ${dataFile}`, 'green');
    log(`  • Cache: schema_cache/${new URL(url).hostname}.json`, 'green');
    
    log('\n💡 Tip: Next run will use cached schema (much faster!)\n', 'gray');

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await stagehand.close();
  }
}

// Parse arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

if (args.length < 2) {
  log('\n❌ Error: Missing required arguments\n', 'red');
  log('Usage: node demo_schema_scraper.js <url> <query>\n', 'yellow');
  log('Run with --help for more information\n', 'gray');
  process.exit(1);
}

const [url, query] = args;

// Validate URL
try {
  new URL(url);
} catch (error) {
  log(`\n❌ Error: Invalid URL: ${url}\n`, 'red');
  process.exit(1);
}

// Run demo
demo(url, query).catch(error => {
  log(`\n❌ Fatal Error: ${error.message}`, 'red');
  process.exit(1);
});
