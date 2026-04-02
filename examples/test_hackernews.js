/**
 * Real-World Test: Hacker News
 * 
 * Tests enhanced CSS schema generation on a different site structure
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { generateCssSchema, extractWithSchema } from '../lib/generateSchemaUtil.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function testHackerNews() {
  console.log('\n' + '='.repeat(70));
  console.log('🔶 REAL-WORLD TEST: Hacker News');
  console.log('='.repeat(70) + '\n');

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: process.env.STAGEHAND_MODEL || "azure/gpt-4o-mini",
    verbose: 0,
    headless: true,
  });

  try {
    await stagehand.init();
    console.log('✅ Stagehand initialized\n');
    
    const page = stagehand.context.pages()[0];

    // Navigate to Hacker News
    console.log('🌐 Navigating to news.ycombinator.com...');
    await page.goto('https://news.ycombinator.com', { waitUntil: 'networkidle' });
    console.log('✅ Page loaded\n');

    // Capture page structure
    console.log('📸 Capturing page structure...');
    const snapshot = await page.snapshot({ includeIframes: false });
    const fullHTML = await page.evaluate(() => document.body.innerHTML);
    const htmlSample = fullHTML.substring(0, 10000);
    console.log('✅ Structure captured\n');

    // Generate schema
    console.log('🤖 Generating CSS schema...\n');
    
    const startTime = Date.now();
    
    const schema = await generateCssSchema(
      snapshot.formattedTree,
      htmlSample,
      'Extract posts with title, url, points, and author',
      page.url()
    );
    
    const generationTime = Date.now() - startTime;

    // Display results
    console.log('\n' + '='.repeat(70));
    console.log('📊 SCHEMA RESULTS');
    console.log('='.repeat(70) + '\n');

    console.log(`Schema Name: ${schema.name}`);
    console.log(`Base Selector: ${schema.baseSelector}`);
    console.log(`Fields: ${schema.fields.length}`);
    schema.fields.forEach(field => {
      console.log(`  • ${field.name} (${field.type}): ${field.selector}`);
    });
    
    console.log(`\nConfidence: ${(schema.confidence * 100).toFixed(1)}%`);
    console.log(`Items Found: ${schema.validation.itemsFound}`);
    console.log(`Refinement Attempts: ${schema.metadata.refinementAttempts}`);
    console.log(`Generation Time: ${(generationTime / 1000).toFixed(2)}s`);

    // Extract data
    console.log('\n' + '='.repeat(70));
    console.log('📊 EXTRACTING DATA');
    console.log('='.repeat(70) + '\n');

    const extractStartTime = Date.now();
    const posts = await extractWithSchema(page, schema);
    const extractTime = Date.now() - extractStartTime;

    console.log(`✅ Extracted ${posts.length} posts in ${(extractTime / 1000).toFixed(2)}s\n`);

    // Display sample
    console.log('🔶 Sample Posts:\n');
    posts.slice(0, 5).forEach((post, i) => {
      console.log(`${i + 1}. ${post.title || 'N/A'}`);
      console.log(`   URL: ${post.url || 'N/A'}`);
      console.log(`   Points: ${post.points || 'N/A'}`);
      console.log(`   Author: ${post.author || 'N/A'}`);
      console.log('');
    });

    // Save results
    const outputFile = `results/hackernews_schema_test_${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      url: page.url(),
      schema,
      extractedPosts: posts,
      performance: {
        schemaGenerationTime: `${(generationTime / 1000).toFixed(2)}s`,
        extractionTime: `${(extractTime / 1000).toFixed(2)}s`,
      }
    }, null, 2));

    console.log(`💾 Results saved to: ${outputFile}\n`);

    // Summary
    console.log('='.repeat(70));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(70) + '\n');
    console.log(`Posts Extracted: ${posts.length}`);
    console.log(`Confidence: ${(schema.confidence * 100).toFixed(1)}%`);
    console.log(`Total Time: ${((generationTime + extractTime) / 1000).toFixed(2)}s\n`);

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error(error.stack);
  } finally {
    await stagehand.close();
  }
}

testHackerNews().catch(console.error);
