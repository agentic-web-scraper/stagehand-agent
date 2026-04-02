/**
 * Generate Scraping Schema from Webpage
 * 
 * Uses page.snapshot() to automatically generate a scraping schema
 * that can be used to build web scraping scripts.
 */

import { Stagehand } from "@browserbasehq/stagehand";
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Generate scraping schema from accessibility tree
 */
function generateScrapingSchema(snapshot) {
  const schema = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalElements: Object.keys(snapshot.xpathMap).length,
      totalLinks: Object.keys(snapshot.urlMap).length,
    },
    structure: {
      tree: snapshot.formattedTree,
    },
    selectors: {},
    links: {},
    scrapingTargets: [],
  };

  // Parse the tree to identify scraping targets
  const treeLines = snapshot.formattedTree.split('\n');
  
  treeLines.forEach(line => {
    // Extract element ID from line like "[0-18] link: Learn more"
    const idMatch = line.match(/\[(\d+-\d+)\]/);
    if (!idMatch) return;
    
    const elementId = idMatch[1];
    const xpath = snapshot.xpathMap[elementId];
    const url = snapshot.urlMap[elementId];
    
    // Identify element type and content
    const contentMatch = line.match(/\]\s+([^:]+)(?::\s+(.+))?/);
    if (!contentMatch) return;
    
    const elementType = contentMatch[1].trim();
    const elementContent = contentMatch[2]?.trim();
    
    // Store selector
    schema.selectors[elementId] = {
      xpath: xpath,
      type: elementType,
      content: elementContent,
    };
    
    // Store link
    if (url) {
      schema.links[elementId] = {
        xpath: xpath,
        url: url,
        text: elementContent,
      };
    }
    
    // Identify common scraping targets
    const scrapableTypes = ['heading', 'link', 'button', 'StaticText', 'paragraph'];
    if (scrapableTypes.some(type => elementType.toLowerCase().includes(type.toLowerCase()))) {
      schema.scrapingTargets.push({
        id: elementId,
        xpath: xpath,
        type: elementType,
        content: elementContent,
        url: url || null,
        scrapingPriority: elementType.includes('heading') ? 'high' : 'medium',
      });
    }
  });
  
  return schema;
}

/**
 * Generate scraping code from schema
 */
function generateScrapingCode(schema, url) {
  const code = `/**
 * Auto-generated scraping script
 * Generated at: ${schema.metadata.generatedAt}
 * Source URL: ${url}
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

async function scrape() {
  const stagehand = new Stagehand({ env: "LOCAL" });
  await stagehand.init();
  const page = stagehand.context.pages()[0];
  
  await page.goto("${url}");
  
  // Extract data using XPath selectors
  const data = await page.evaluate(() => {
    const getElementByXPath = (xpath) => {
      return document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
    };
    
    return {
${schema.scrapingTargets.slice(0, 10).map(target => {
  const safeName = (target.content || target.type).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 30);
  return `      ${safeName}: getElementByXPath("${target.xpath}")?.textContent?.trim(),`;
}).join('\n')}
    };
  });
  
  console.log("Scraped data:", data);
  
  await stagehand.close();
  return data;
}

scrape().catch(console.error);
`;
  
  return code;
}

async function generateSchema() {
  log("\n" + "=".repeat(70), "cyan");
  log("🔧 GENERATE SCRAPING SCHEMA FROM WEBPAGE", "bright");
  log("=".repeat(70), "cyan");
  
  let stagehand;
  
  try {
    // Get URL from command line or use default
    const targetUrl = process.argv[2] || "https://example.com";
    
    log(`\n🌐 Target URL: ${targetUrl}`, "yellow");
    log("⏳ Initializing Stagehand...", "yellow");
    
    stagehand = new Stagehand({
      env: "LOCAL",
      verbose: 0,
      headless: false,
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];
    log("✅ Stagehand initialized\n", "green");

    // Navigate to page
    log("📄 Loading page...", "yellow");
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    log("✅ Page loaded\n", "green");

    // Capture snapshot
    log("📸 Capturing page snapshot...", "yellow");
    const snapshot = await page.snapshot();
    log("✅ Snapshot captured\n", "green");

    // Generate schema
    log("🔧 Generating scraping schema...", "yellow");
    const schema = generateScrapingSchema(snapshot);
    log("✅ Schema generated\n", "green");

    // Display results
    log("╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ 📊 SCRAPING SCHEMA ANALYSIS                                    ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    log("📈 Statistics:", "bright");
    log(`  • Total elements: ${schema.metadata.totalElements}`, "blue");
    log(`  • Total links: ${schema.metadata.totalLinks}`, "blue");
    log(`  • Scraping targets identified: ${schema.scrapingTargets.length}`, "blue");

    log("\n🎯 Top Scraping Targets:", "bright");
    log("─".repeat(70), "cyan");
    schema.scrapingTargets.slice(0, 10).forEach((target, i) => {
      log(`${i + 1}. [${target.type}] ${target.content || '(no content)'}`, "blue");
      log(`   XPath: ${target.xpath}`, "magenta");
      if (target.url) {
        log(`   URL: ${target.url}`, "green");
      }
      log(`   Priority: ${target.scrapingPriority}`, "yellow");
      log("", "reset");
    });
    log("─".repeat(70), "cyan");

    log("\n🔗 Links Found:", "bright");
    log("─".repeat(70), "cyan");
    Object.entries(schema.links).forEach(([id, link], i) => {
      log(`${i + 1}. ${link.text || '(no text)'}`, "blue");
      log(`   XPath: ${link.xpath}`, "magenta");
      log(`   URL: ${link.url}`, "green");
      log("", "reset");
    });
    log("─".repeat(70), "cyan");

    // Generate scraping code
    log("\n💻 Generating scraping code...", "yellow");
    const scrapingCode = generateScrapingCode(schema, targetUrl);
    log("✅ Code generated\n", "green");

    // Save files
    const timestamp = Date.now();
    const schemaFile = `results/scraping_schema_${timestamp}.json`;
    const codeFile = `results/scraping_code_${timestamp}.js`;
    
    fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2));
    fs.writeFileSync(codeFile, scrapingCode);
    
    log("💾 Files saved:", "green");
    log(`  • Schema: ${schemaFile}`, "blue");
    log(`  • Code: ${codeFile}`, "blue");

    // Display code preview
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ 💻 GENERATED SCRAPING CODE PREVIEW                             ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    const codeLines = scrapingCode.split('\n');
    codeLines.slice(0, 30).forEach(line => console.log(line));
    if (codeLines.length > 30) {
      log(`\n... (${codeLines.length - 30} more lines)`, "cyan");
    }

    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ ✅ SCHEMA GENERATION COMPLETE                                  ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    log("📋 Next Steps:", "bright");
    log("  1. Review the generated schema JSON", "blue");
    log("  2. Customize the scraping code as needed", "blue");
    log("  3. Run the generated scraping script", "blue");
    log(`  4. Command: node ${codeFile}`, "blue");

    log("\n💡 Why page.snapshot() is Best for Scraping:", "yellow");
    log("  ✓ Provides XPath selectors (more stable than CSS)", "green");
    log("  ✓ Shows element hierarchy and relationships", "green");
    log("  ✓ Identifies all links automatically", "green");
    log("  ✓ Reveals semantic structure (headings, buttons, etc.)", "green");
    log("  ✓ Works with dynamic content and shadow DOM", "green");

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
log("\n💡 Usage: node generate_scraping_schema.js [URL]", "cyan");
log("   Example: node generate_scraping_schema.js https://news.ycombinator.com\n", "cyan");

generateSchema().catch(console.error);
