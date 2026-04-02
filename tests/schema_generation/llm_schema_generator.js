/**
 * LLM-Based CSS Schema Generator (Inspired by Crawl4AI)
 * 
 * Uses LLM to automatically generate CSS selectors from HTML/Aria Tree
 * No hardcoded selectors - fully dynamic!
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import fs from 'fs';
import OpenAI from 'openai';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Initialize OpenAI for schema generation
const openai = new OpenAI({
  apiKey: process.env.AZURE_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-4o-mini`,
  defaultQuery: { 'api-version': '2024-08-01-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_API_KEY },
});

/**
 * Generate CSS extraction schema using LLM
 * Inspired by Crawl4AI's JsonCssExtractionStrategy.generate_schema()
 */
async function generateCssSchema(ariaTree, htmlSample, query) {
  log("\n🤖 Generating CSS schema with LLM...", "yellow");
  
  const prompt = `You are an expert web scraping assistant. Analyze the provided HTML structure and generate a CSS-based extraction schema.

ARIA TREE (Accessibility Tree):
${ariaTree.substring(0, 3000)}...

HTML SAMPLE:
${htmlSample.substring(0, 2000)}...

USER QUERY: ${query}

TASK:
Generate a JSON schema with CSS selectors to extract the requested data. The schema should:
1. Identify the container element that repeats for each item
2. Provide CSS selectors for each field to extract
3. Use CSS selectors, NOT XPath (CSS works across pages)
4. Be generic enough to work on similar pages

OUTPUT FORMAT (JSON only, no explanation):
{
  "baseSelector": "CSS selector for container element (e.g., 'tr.athing', 'article', '.post')",
  "fields": [
    {
      "name": "field_name",
      "selector": "CSS selector relative to baseSelector",
      "type": "text|attribute|number",
      "attribute": "href|src|etc (only if type is attribute)",
      "transform": "optional transformation (e.g., 'parseInt', 'trim')"
    }
  ],
  "pagination": {
    "type": "query|path|none",
    "pattern": "URL pattern (e.g., '?p={page}', '/page/{page}/')"
  }
}

EXAMPLE for a news site:
{
  "baseSelector": "article.post",
  "fields": [
    {"name": "title", "selector": "h2.title", "type": "text"},
    {"name": "url", "selector": "a.permalink", "type": "attribute", "attribute": "href"},
    {"name": "author", "selector": ".author-name", "type": "text"},
    {"name": "date", "selector": "time", "type": "text"}
  ],
  "pagination": {"type": "query", "pattern": "?page={page}"}
}

Generate the schema now:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // This is ignored for Azure, uses deployment from baseURL
      messages: [
        { role: "system", content: "You are a web scraping expert. Output only valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content.trim();
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }
    
    const schema = JSON.parse(jsonStr);
    
    log("✅ Schema generated successfully!", "green");
    log(`   Base selector: ${schema.baseSelector}`, "blue");
    log(`   Fields: ${schema.fields.length}`, "blue");
    log(`   Pagination: ${schema.pagination?.type || 'none'}`, "blue");
    
    return schema;
  } catch (error) {
    log(`❌ Schema generation failed: ${error.message}`, "red");
    throw error;
  }
}

/**
 * Extract data using generated schema
 */
async function extractWithSchema(page, schema) {
  return await page.evaluate((schema) => {
    const items = [];
    const containers = document.querySelectorAll(schema.baseSelector);
    
    for (const container of containers) {
      const item = {};
      
      for (const field of schema.fields) {
        try {
          const element = container.querySelector(field.selector);
          
          if (!element) continue;
          
          let value;
          if (field.type === 'attribute' && field.attribute) {
            value = element.getAttribute(field.attribute);
          } else if (field.type === 'text') {
            value = element.textContent?.trim();
          } else if (field.type === 'number') {
            const text = element.textContent?.trim();
            const match = text?.match(/(\d+)/);
            value = match ? parseInt(match[1]) : 0;
          }
          
          // Apply transformation if specified
          if (value && field.transform) {
            if (field.transform === 'parseInt') {
              value = parseInt(value);
            } else if (field.transform === 'parseFloat') {
              value = parseFloat(value);
            } else if (field.transform === 'trim') {
              value = value.trim();
            }
          }
          
          item[field.name] = value;
        } catch (err) {
          // Skip field if extraction fails
        }
      }
      
      // Only add item if it has at least one field
      if (Object.keys(item).length > 0) {
        items.push(item);
      }
    }
    
    return items;
  }, schema);
}

/**
 * Main scraper with LLM-generated schema
 */
async function llmBasedScraper() {
  log("\n" + "=".repeat(70), "cyan");
  log("🤖 LLM-BASED CSS SCHEMA GENERATOR (Crawl4AI Style)", "bright");
  log("=".repeat(70), "cyan");
  
  let stagehand;
  
  try {
    const url = process.argv[2] || "https://news.ycombinator.com";
    const query = process.argv[3] || "Extract posts with title, url, points, author, and time";
    const maxPages = parseInt(process.argv[4]) || 2;
    
    log(`\n🌐 URL: ${url}`, "yellow");
    log(`🎯 Query: ${query}`, "yellow");
    log(`📄 Max pages: ${maxPages}`, "yellow");
    log("⏳ Initializing...\n", "yellow");
    
    stagehand = new Stagehand({
      env: "LOCAL",
      verbose: 0,
      headless: false,
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];
    log("✅ Stagehand initialized\n", "green");

    // Step 1: Load page and capture structure
    log("╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ STEP 1: Capture Page Structure                                ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    await page.goto(url, { waitUntil: 'networkidle' });
    log("✅ Page loaded", "green");
    
    // Get aria tree
    const snapshot = await page.snapshot({ includeIframes: false });
    log(`✅ Aria tree captured: ${Object.keys(snapshot.xpathMap).length} elements\n`, "green");
    
    // Get HTML sample
    const htmlSample = await page.evaluate(() => {
      return document.body.innerHTML.substring(0, 5000);
    });
    log("✅ HTML sample captured\n", "green");

    // Step 2: Generate schema with LLM
    log("╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ STEP 2: Generate CSS Schema with LLM                          ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    const schema = await generateCssSchema(
      snapshot.formattedTree,
      htmlSample,
      query
    );
    
    // Display generated schema
    log("\n📋 Generated Schema:", "bright");
    log(JSON.stringify(schema, null, 2), "blue");
    
    // Save schema for reuse
    const schemaFile = `results/css_schema_${Date.now()}.json`;
    fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2));
    log(`\n💾 Schema saved to: ${schemaFile}`, "green");
    log("   (Reuse this schema for future scrapes - no more LLM calls!)\n", "yellow");

    // Step 3: Extract data using generated schema
    log("╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ STEP 3: Extract Data Using Generated Schema                   ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    const allData = [];
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      log(`📄 Scraping page ${pageNum}/${maxPages}...`, "yellow");
      
      // Navigate to next page if needed
      if (pageNum > 1 && schema.pagination?.type !== 'none') {
        let nextUrl = url;
        if (schema.pagination.type === 'query') {
          const pattern = schema.pagination.pattern.replace('{page}', pageNum);
          nextUrl = url.includes('?') ? `${url}&${pattern.substring(1)}` : `${url}${pattern}`;
        } else if (schema.pagination.type === 'path') {
          nextUrl = url + schema.pagination.pattern.replace('{page}', pageNum);
        }
        
        log(`   🌐 Navigating to: ${nextUrl}`, "blue");
        await page.goto(nextUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
      }
      
      // Extract data
      const pageData = await extractWithSchema(page, schema);
      log(`   ✅ Extracted ${pageData.length} items`, "green");
      
      allData.push(...pageData);
    }
    
    log(`\n✅ Total items extracted: ${allData.length}\n`, "green");

    // Display results
    log("╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ 📊 EXTRACTED DATA                                              ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    allData.slice(0, 10).forEach((item, i) => {
      log(`${i + 1}. ${JSON.stringify(item, null, 2)}`, "blue");
      log("", "reset");
    });
    
    if (allData.length > 10) {
      log(`... and ${allData.length - 10} more items\n`, "gray");
    }

    // Save results
    const outputFile = `results/llm_scraper_${Date.now()}.json`;
    const outputData = {
      timestamp: new Date().toISOString(),
      url: url,
      query: query,
      method: "LLM-generated CSS schema (Crawl4AI style)",
      pagesScraped: maxPages,
      totalItems: allData.length,
      generatedSchema: schema,
      data: allData,
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    log(`💾 Results saved to: ${outputFile}`, "green");

    // Statistics
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ 📊 STATISTICS                                                  ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    log(`📊 Total items: ${allData.length}`, "blue");
    log(`📄 Pages scraped: ${maxPages}`, "blue");
    log(`🎯 Fields extracted: ${schema.fields.map(f => f.name).join(', ')}`, "blue");
    log(`🔄 Pagination: ${schema.pagination?.type || 'none'}`, "blue");

    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ ✅ SCRAPING COMPLETE                                           ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    log("💡 How It Works (Crawl4AI Style):", "yellow");
    log("  1. ✅ Capture aria tree + HTML sample", "green");
    log("  2. ✅ LLM analyzes structure and generates CSS schema", "green");
    log("  3. ✅ Schema is saved for reuse (no more LLM calls!)", "green");
    log("  4. ✅ Extract data using generated selectors", "green");
    log("  5. ✅ Works across multiple pages", "green");
    
    log("\n🎯 Key Advantages:", "yellow");
    log("  • No hardcoded selectors!", "blue");
    log("  • LLM generates schema once, reuse forever", "blue");
    log("  • Works on any website", "blue");
    log("  • Schema is human-readable and editable", "blue");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    console.error(error.stack);
  } finally {
    if (stagehand) {
      log("\n🔒 Closing Stagehand...", "yellow");
      await stagehand.close();
      log("✅ Done!\n", "green");
    }
  }
}

// Run
log("\n💡 Usage: node llm_schema_generator.js [url] [query] [max_pages]", "cyan");
log("   Example: node llm_schema_generator.js https://news.ycombinator.com \"Extract posts\" 2", "cyan");
log("   Default: Hacker News, extract posts, 2 pages\n", "cyan");

llmBasedScraper().catch(console.error);
