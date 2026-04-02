/**
 * Simple Demo: Schema Generator Tools
 * 
 * Shows how to use schema generator tools directly (without agent)
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { 
  generateSchemaToolFactory, 
  extractWithSchemaToolFactory 
} from '../lib/agentTools.js';
import dotenv from 'dotenv';

dotenv.config();

async function demo() {
  console.log('\n🤖 Schema Generator Tools Demo\n');

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: process.env.STAGEHAND_MODEL || "azure/gpt-4o-mini",
    verbose: 0,
    headless: true,
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    // Navigate
    console.log('📍 Navigating to books.toscrape.com...');
    await page.goto('http://books.toscrape.com', { waitUntil: 'networkidle' });
    console.log('✅ Page loaded\n');

    // Create tools
    const generateSchemaTool = generateSchemaToolFactory(page, page.url());
    const extractTool = extractWithSchemaToolFactory(page);

    // Step 1: Generate schema
    console.log('🔧 Step 1: Generate Schema\n');
    const schemaResult = await generateSchemaTool.execute({
      query: "Extract books with title, price, and rating"
    });

    if (!schemaResult.success) {
      throw new Error(`Schema generation failed: ${schemaResult.error}`);
    }

    console.log('✅ Schema Generated:');
    console.log(`   Name: ${schemaResult.schema.name}`);
    console.log(`   Base Selector: ${schemaResult.schema.baseSelector}`);
    console.log(`   Fields: ${schemaResult.schema.fields.map(f => f.name).join(', ')}`);
    console.log(`   Confidence: ${(schemaResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Refinement Attempts: ${schemaResult.refinementAttempts}\n`);

    // Step 2: Extract data
    console.log('📊 Step 2: Extract Data\n');
    const extractResult = await extractTool.execute({
      schema: schemaResult.schema
    });

    if (!extractResult.success) {
      throw new Error(`Extraction failed: ${extractResult.error}`);
    }

    console.log('✅ Data Extracted:');
    console.log(`   Items: ${extractResult.count}`);
    console.log(`   Post-Extraction Confidence: ${(extractResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Final Confidence: ${(extractResult.finalConfidence * 100).toFixed(1)}%\n`);

    // Display sample
    console.log('📦 Sample Items:\n');
    extractResult.items.slice(0, 3).forEach((item, i) => {
      console.log(`${i + 1}. ${JSON.stringify(item, null, 2)}`);
    });

    console.log(`\n... and ${extractResult.count - 3} more items\n`);
    console.log('✅ Demo complete!\n');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await stagehand.close();
  }
}

demo().catch(console.error);
