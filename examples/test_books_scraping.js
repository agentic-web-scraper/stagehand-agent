/**
 * Real-World Test: Books.toscrape.com
 * 
 * Tests enhanced CSS schema generation with validation, confidence, and refinement
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { generateCssSchema, extractWithSchema } from '../lib/generateSchemaUtil.js';
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

async function testBooksToScrape() {
  log('\n' + '='.repeat(70), 'cyan');
  log('📚 REAL-WORLD TEST: Books.toscrape.com', 'bright');
  log('='.repeat(70) + '\n', 'cyan');

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: process.env.STAGEHAND_MODEL || "azure/gpt-4o-mini",
    verbose: 0,
    headless: true,
  });

  try {
    await stagehand.init();
    log('✅ Stagehand initialized\n', 'green');
    
    const page = stagehand.context.pages()[0];

    // Navigate to books.toscrape.com
    log('🌐 Navigating to books.toscrape.com...', 'yellow');
    await page.goto('http://books.toscrape.com', { waitUntil: 'networkidle' });
    log('✅ Page loaded\n', 'green');

    // Capture page structure
    log('📸 Capturing page structure...', 'yellow');
    const snapshot = await page.snapshot({ includeIframes: false });
    
    // Get full HTML for better validation
    const fullHTML = await page.evaluate(() => document.body.innerHTML);
    const htmlSample = fullHTML.substring(0, 10000); // First 10KB for LLM
    
    log('✅ Structure captured\n', 'green');

    // Generate schema with enhanced features
    log('🤖 Generating CSS schema with LLM...', 'bright');
    log('   (with validation, confidence scoring, and auto-refinement)\n', 'blue');
    
    const startTime = Date.now();
    
    const schema = await generateCssSchema(
      snapshot.formattedTree,
      htmlSample,
      'Extract books with title, price, rating, and availability',
      page.url()
    );
    
    const generationTime = Date.now() - startTime;

    // Display schema results
    log('\n' + '='.repeat(70), 'cyan');
    log('📊 SCHEMA GENERATION RESULTS', 'bright');
    log('='.repeat(70) + '\n', 'cyan');

    log(`Schema Name: ${schema.name}`, 'yellow');
    log(`Base Selector: ${schema.baseSelector}`, 'yellow');
    log(`Fields: ${schema.fields.length}`, 'yellow');
    schema.fields.forEach(field => {
      log(`  • ${field.name} (${field.type}): ${field.selector}`, 'blue');
    });
    
    log(`\nValidation:`, 'yellow');
    log(`  Structure Valid: ${schema.validation.structureValid ? '✅' : '❌'}`, 'blue');
    log(`  Base Selector Valid: ${schema.validation.baseSelectorValid ? '✅' : '❌'}`, 'blue');
    log(`  Items Found: ${schema.validation.itemsFound}`, 'blue');
    log(`  Confidence: ${(schema.confidence * 100).toFixed(1)}%`, schema.confidence >= 0.7 ? 'green' : 'yellow');
    
    log(`\nMetadata:`, 'yellow');
    log(`  Generation Time: ${(generationTime / 1000).toFixed(2)}s`, 'blue');
    log(`  HTML Size: ${schema.metadata.htmlSize} bytes`, 'blue');
    log(`  Processed Size: ${schema.metadata.processedSize} bytes`, 'blue');
    log(`  Refinement Attempts: ${schema.metadata.refinementAttempts}`, 'blue');
    
    if (schema.validation.errors.length > 0) {
      log(`\n⚠️  Validation Errors:`, 'yellow');
      schema.validation.errors.forEach(err => log(`  • ${err}`, 'yellow'));
    }

    // Test extraction
    log('\n' + '='.repeat(70), 'cyan');
    log('📊 EXTRACTING DATA WITH SCHEMA', 'bright');
    log('='.repeat(70) + '\n', 'cyan');

    const extractStartTime = Date.now();
    const books = await extractWithSchema(page, schema);
    const extractTime = Date.now() - extractStartTime;

    log(`✅ Extracted ${books.length} books in ${(extractTime / 1000).toFixed(2)}s\n`, 'green');

    // Display sample books
    log('📚 Sample Books:\n', 'bright');
    books.slice(0, 5).forEach((book, i) => {
      log(`${i + 1}. ${book.title || 'N/A'}`, 'yellow');
      log(`   Price: ${book.price || 'N/A'}`, 'blue');
      log(`   Rating: ${book.rating || 'N/A'}`, 'blue');
      log(`   Availability: ${book.availability || 'N/A'}`, 'blue');
      log('');
    });

    if (books.length > 5) {
      log(`... and ${books.length - 5} more books\n`, 'blue');
    }

    // Save results
    const outputFile = `results/books_schema_test_${Date.now()}.json`;
    const outputData = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      schema: schema,
      extractedBooks: books,
      performance: {
        schemaGenerationTime: `${(generationTime / 1000).toFixed(2)}s`,
        extractionTime: `${(extractTime / 1000).toFixed(2)}s`,
        totalTime: `${((generationTime + extractTime) / 1000).toFixed(2)}s`
      }
    };

    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    log(`💾 Results saved to: ${outputFile}\n`, 'green');

    // Summary
    log('='.repeat(70), 'cyan');
    log('✅ TEST COMPLETE', 'bright');
    log('='.repeat(70) + '\n', 'cyan');

    log('Summary:', 'yellow');
    log(`  • Schema Confidence: ${(schema.confidence * 100).toFixed(1)}%`, 'blue');
    log(`  • Books Extracted: ${books.length}`, 'blue');
    log(`  • Refinement Attempts: ${schema.metadata.refinementAttempts}`, 'blue');
    log(`  • Total Time: ${((generationTime + extractTime) / 1000).toFixed(2)}s`, 'blue');
    
    if (schema.confidence >= 0.9) {
      log('\n🎉 Excellent! High confidence schema generated!', 'green');
    } else if (schema.confidence >= 0.7) {
      log('\n✅ Good! Schema meets confidence threshold.', 'green');
    } else {
      log('\n⚠️  Low confidence. Consider manual review.', 'yellow');
    }

    log('');

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'yellow');
    console.error(error.stack);
  } finally {
    await stagehand.close();
  }
}

// Run test
testBooksToScrape().catch(console.error);
