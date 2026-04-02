/**
 * Example: Agent Using Schema Generator Tools
 * 
 * Demonstrates how an autonomous agent can use schema generation tools
 * to scrape websites without hardcoded selectors
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { 
  generateSchemaToolFactory, 
  extractWithSchemaToolFactory,
  detectPaginationToolFactory 
} from '../lib/agentTools.js';
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
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function agentWithSchemaTools() {
  log('\n' + '='.repeat(70), 'cyan');
  log('🤖 AGENT WITH SCHEMA GENERATOR TOOLS', 'bright');
  log('='.repeat(70) + '\n', 'cyan');

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: process.env.STAGEHAND_MODEL || "azure/gpt-4o-mini",
    verbose: 1,
    headless: false,
  });

  try {
    await stagehand.init();
    log('✅ Stagehand initialized\n', 'green');
    
    const page = stagehand.context.pages()[0];

    // Navigate to target site
    const url = 'http://books.toscrape.com';
    log(`🌐 Navigating to ${url}...`, 'yellow');
    await page.goto(url, { waitUntil: 'networkidle' });
    log('✅ Page loaded\n', 'green');

    // Create agent with schema tools
    log('🤖 Creating agent with schema tools...', 'bright');
    
    const agent = stagehand.agent({
      model: process.env.STAGEHAND_MODEL || "azure/gpt-4o-mini",
      mode: "dom",
      tools: {
        generateSchema: generateSchemaToolFactory(page, page.url()),
        extractWithSchema: extractWithSchemaToolFactory(page),
        detectPagination: detectPaginationToolFactory(page),
      },
      systemPrompt: `You are an expert web scraping agent with access to powerful schema generation tools.

AVAILABLE TOOLS:
1. generateSchema - Generates CSS extraction schema from current page
2. extractWithSchema - Extracts data using a generated schema
3. detectPagination - Detects pagination patterns

WORKFLOW:
1. Call generateSchema with a query describing what to extract
2. Review the generated schema (baseSelector, fields, confidence)
3. Call extractWithSchema with the schema to get actual data
4. Optionally call detectPagination to find more pages

IMPORTANT:
- Always generate schema BEFORE extracting data
- The schema is reusable - generate once, extract many times
- Check confidence scores - high confidence (>70%) means good schema
- Return the extracted data in your final response`,
    });

    log('✅ Agent created with tools\n', 'green');

    // Execute agent
    log('╔════════════════════════════════════════════════════════════════╗', 'cyan');
    log('║ 🤖 AGENT EXECUTING WITH SCHEMA TOOLS                          ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════════╝\n', 'cyan');

    const startTime = Date.now();
    
    const result = await agent.execute({
      instruction: "Generate a schema to extract books with title, price, and rating. Then use the schema to extract data from the current page. Return the extracted books.",
      maxSteps: 20,
    });
    
    const duration = Date.now() - startTime;

    // Display results
    log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
    log('║ ✅ AGENT EXECUTION COMPLETE                                    ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════════╝\n', 'cyan');

    log(`⏱️  Total time: ${(duration / 1000).toFixed(2)}s`, 'gray');
    log(`📊 Steps taken: ${result.steps || 'unknown'}`, 'gray');
    log(`✅ Completed: ${result.completed ? 'Yes' : 'No'}`, result.completed ? 'green' : 'yellow');
    
    log('\n📦 Agent Output:', 'bright');
    console.log(JSON.stringify(result.output, null, 2));

    // Save results
    const outputFile = `results/agent_schema_tools_${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      url: page.url(),
      instruction: "Generate schema and extract books",
      result: result,
      performance: {
        duration: `${(duration / 1000).toFixed(2)}s`,
        steps: result.steps
      }
    }, null, 2));

    log(`\n💾 Results saved to: ${outputFile}`, 'green');
    log('\n✅ Demo complete!\n', 'green');

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'yellow');
    console.error(error.stack);
  } finally {
    await stagehand.close();
  }
}

// Run demo
agentWithSchemaTools().catch(console.error);
