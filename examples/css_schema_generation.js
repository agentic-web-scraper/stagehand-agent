/**
 * CSS Schema Generation Example
 * 
 * Demonstrates enhanced schema generation with validation, confidence scoring, and file caching
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { generateCssSchema, extractWithSchema, listCachedSchemas } from '../lib/generateSchemaUtil.js';
import dotenv from 'dotenv';

dotenv.config();

async function example() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 CSS Schema Generation Example');
  console.log('='.repeat(70) + '\n');

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: process.env.STAGEHAND_MODEL || "azure/gpt-4o-mini",
    verbose: 0,
    headless: true,
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    // Example 1: Generate schema for Hacker News
    console.log('📝 Example 1: Generate Schema for Hacker News\n');
    
    await page.goto('https://news.ycombinator.com', { waitUntil: 'networkidle' });
    
    // Capture page structure
    const snapshot = await page.snapshot({ includeIframes: false });
    const htmlSample = await page.evaluate(() => 
      document.body.innerHTML.substring(0, 5000)
    );
    
    // Generate schema
    const schema = await generateCssSchema(
      snapshot.formattedTree,
      htmlSample,
      'Extract posts with title, url, points, and author',
      page.url()
    );
    
    console.log('\n✅ Schema Generated:');
    console.log(`   Name: ${schema.name}`);
    console.log(`   Base Selector: ${schema.baseSelector}`);
    console.log(`   Fields: ${schema.fields.map(f => f.name).join(', ')}`);
    console.log(`   Confidence: ${(schema.confidence * 100).toFixed(1)}%`);
    console.log(`   Items Found: ${schema.validation.itemsFound}`);
    console.log(`   Validation: ${schema.validation.structureValid ? '✅ Valid' : '❌ Invalid'}`);
    
    if (schema.validation.errors.length > 0) {
      console.log(`   Errors: ${schema.validation.errors.join(', ')}`);
    }
    
    // Example 2: Extract data using schema
    console.log('\n📊 Example 2: Extract Data Using Schema\n');
    
    const items = await extractWithSchema(page, schema);
    
    console.log(`✅ Extracted ${items.length} items\n`);
    console.log('Sample items:');
    items.slice(0, 3).forEach((item, i) => {
      console.log(`\n${i + 1}. ${JSON.stringify(item, null, 2)}`);
    });
    
    // Example 3: Cache demonstration
    console.log('\n💾 Example 3: Cache Demonstration\n');
    
    // Generate schema again (should load from cache)
    console.log('Generating schema again (should use cache)...');
    const cachedSchema = await generateCssSchema(
      snapshot.formattedTree,
      htmlSample,
      'Extract posts with title, url, points, and author',
      page.url()
    );
    
    console.log(`✅ Schema loaded (from ${cachedSchema === schema ? 'memory' : 'file'} cache)`);
    
    // List all cached schemas
    console.log('\n📋 Cached Schemas:\n');
    const cached = await listCachedSchemas();
    cached.forEach(s => {
      console.log(`   • ${s.domain}`);
      console.log(`     Name: ${s.name}`);
      console.log(`     Confidence: ${(s.confidence * 100).toFixed(1)}%`);
      console.log(`     Generated: ${new Date(s.generatedAt).toLocaleString()}`);
    });
    
    console.log('\n✅ Example Complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await stagehand.close();
  }
}

// Run example
example().catch(console.error);
