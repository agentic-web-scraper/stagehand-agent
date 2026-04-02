/**
 * CSS Schema Generation Utilities
 * 
 * Generates CSS extraction schemas using LLM by analyzing page structure
 * Includes validation, confidence scoring, and file-based caching
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import { JSDOM } from 'jsdom';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

// Initialize OpenAI for schema generation
const openai = new OpenAI({
  apiKey: process.env.AZURE_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-4o-mini`,
  defaultQuery: { 'api-version': '2024-08-01-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_API_KEY },
});

// Schema cache by domain (in-memory for speed)
const schemaCache = new Map();

// File cache directory
const CACHE_DIR = './schema_cache';

// Valid field types
const VALID_FIELD_TYPES = ['text', 'attribute', 'html', 'regex', 'number'];

/**
 * Preprocess HTML for LLM efficiency
 * - Remove scripts, styles, comments
 * - Limit to 8KB
 * 
 * @param {string} html - Raw HTML
 * @returns {string} Processed HTML
 */
function preprocessHTML(html) {
  if (!html) return '';

  let processed = html;

  // Remove script tags and content
  processed = processed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and content
  processed = processed.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML comments
  processed = processed.replace(/<!--[\s\S]*?-->/g, '');

  // Remove excessive whitespace
  processed = processed.replace(/\s+/g, ' ').trim();

  // Limit to 8KB (8192 bytes)
  const MAX_SIZE = 8192;
  if (processed.length > MAX_SIZE) {
    processed = processed.substring(0, MAX_SIZE) + '...';
  }

  return processed;
}

/**
 * Validate schema structure
 * 
 * @param {Object} schema - Schema to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateSchema(schema) {
  const errors = [];

  // Check required top-level fields
  if (!schema.name || typeof schema.name !== 'string') {
    errors.push('Schema must have a "name" field (string)');
  }

  if (!schema.baseSelector || typeof schema.baseSelector !== 'string') {
    errors.push('Schema must have a "baseSelector" field (string)');
  }

  if (!schema.fields || !Array.isArray(schema.fields)) {
    errors.push('Schema must have a "fields" array');
  } else if (schema.fields.length === 0) {
    errors.push('Schema "fields" array cannot be empty');
  } else {
    // Validate each field
    schema.fields.forEach((field, index) => {
      if (!field.name || typeof field.name !== 'string') {
        errors.push(`Field ${index}: missing or invalid "name"`);
      }

      if (!field.selector || typeof field.selector !== 'string') {
        errors.push(`Field ${index} (${field.name}): missing or invalid "selector"`);
      }

      if (!field.type || !VALID_FIELD_TYPES.includes(field.type)) {
        errors.push(`Field ${index} (${field.name}): invalid "type" (must be one of: ${VALID_FIELD_TYPES.join(', ')})`);
      }

      // Type-specific validation
      if (field.type === 'attribute' && !field.attribute) {
        errors.push(`Field ${index} (${field.name}): "attribute" type requires "attribute" property`);
      }

      if (field.type === 'regex' && !field.pattern) {
        errors.push(`Field ${index} (${field.name}): "regex" type requires "pattern" property`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Test schema against HTML to verify selectors work
 * 
 * @param {Object} schema - Schema to test
 * @param {string} html - HTML content to test against
 * @returns {Object} Test results
 */
function testSchemaOnHTML(schema, html) {
  if (!html || html.trim().length === 0) {
    return {
      baseSelectorValid: false,
      itemsFound: 0,
      fieldResults: []
    };
  }

  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Test baseSelector
    const containers = document.querySelectorAll(schema.baseSelector);
    const itemsFound = containers.length;
    const baseSelectorValid = itemsFound > 0;

    // Test each field selector on first container
    const fieldResults = [];
    if (containers.length > 0) {
      const firstContainer = containers[0];

      schema.fields.forEach(field => {
        try {
          const element = firstContainer.querySelector(field.selector);
          fieldResults.push({
            name: field.name,
            found: element !== null,
            selector: field.selector
          });
        } catch (error) {
          fieldResults.push({
            name: field.name,
            found: false,
            selector: field.selector,
            error: error.message
          });
        }
      });
    }

    return {
      baseSelectorValid,
      itemsFound,
      fieldResults
    };
  } catch (error) {
    return {
      baseSelectorValid: false,
      itemsFound: 0,
      fieldResults: [],
      error: error.message
    };
  }
}

/**
 * Calculate confidence score for schema
 * 
 * @param {Object} testResult - Result from testSchemaOnHTML
 * @param {boolean} isPreExtraction - Whether this is before or after extraction
 * @returns {number} Confidence score (0-1)
 */
function calculateConfidence(testResult, isPreExtraction = true) {
  // If testing against limited HTML sample (pre-extraction), be more lenient
  if (isPreExtraction && !testResult.baseSelectorValid) {
    // Don't return 0 immediately - the sample might not contain the content
    // Give a base score if schema structure is valid
    return 0.5; // Neutral confidence - needs actual extraction to verify
  }
  
  // Post-extraction or valid baseSelector found
  if (!testResult.baseSelectorValid && !isPreExtraction) {
    return 0; // Definitely invalid if extraction failed
  }

  let score = 0;

  // Base score for valid baseSelector (30%)
  if (testResult.baseSelectorValid) {
    score += 0.3;
  } else if (isPreExtraction) {
    // Give partial credit for pre-extraction (might be in different part of HTML)
    score += 0.15;
  }

  // Score for items found (30%)
  if (testResult.itemsFound > 0) {
    // More items = higher confidence (capped at 10 items)
    const itemScore = Math.min(testResult.itemsFound / 10, 1) * 0.3;
    score += itemScore;
  } else if (isPreExtraction) {
    // Give partial credit for pre-extraction
    score += 0.15;
  }

  // Score for field success rate (40%)
  if (testResult.fieldResults && testResult.fieldResults.length > 0) {
    const successfulFields = testResult.fieldResults.filter(f => f.found).length;
    const fieldSuccessRate = successfulFields / testResult.fieldResults.length;
    score += fieldSuccessRate * 0.4;
  } else if (isPreExtraction && testResult.fieldResults.length === 0) {
    // No fields tested (no items found in sample), give partial credit
    score += 0.2;
  }

  return Math.min(Math.max(score, 0), 1); // Clamp between 0 and 1
}

/**
 * Calculate post-extraction confidence based on actual extracted data
 * 
 * @param {Object} schema - Schema used for extraction
 * @param {Array} extractedItems - Items extracted from page
 * @param {number} expectedMinItems - Minimum expected items (default: 1)
 * @returns {number} Confidence score (0-1)
 */
function calculatePostExtractionConfidence(schema, extractedItems, expectedMinItems = 1) {
  if (!extractedItems || extractedItems.length === 0) {
    return 0; // No data extracted = no confidence
  }

  let score = 0;

  // Base score for successful extraction (40%)
  score += 0.4;

  // Score for number of items (30%)
  const itemRatio = Math.min(extractedItems.length / Math.max(expectedMinItems, 10), 1);
  score += itemRatio * 0.3;

  // Score for field completeness (30%)
  // Check how many fields have data in extracted items
  const firstItem = extractedItems[0];
  const expectedFields = schema.fields.length;
  const populatedFields = Object.keys(firstItem).filter(key => {
    const value = firstItem[key];
    return value !== null && value !== undefined && value !== '';
  }).length;
  
  const fieldCompleteness = populatedFields / expectedFields;
  score += fieldCompleteness * 0.3;

  return Math.min(Math.max(score, 0), 1);
}

/**
 * Save schema to file cache
 * 
 * @param {string} domain - Domain name
 * @param {Object} schema - Schema to cache
 */
async function saveSchemaToFile(domain, schema) {
  try {
    // Ensure cache directory exists
    await fs.mkdir(CACHE_DIR, { recursive: true });

    // Save schema as JSON file
    const filePath = path.join(CACHE_DIR, `${domain}.json`);
    await fs.writeFile(filePath, JSON.stringify(schema, null, 2), 'utf-8');

    console.log(`   💾 Schema cached to file: ${domain}.json`);
  } catch (error) {
    console.error(`   ⚠️  Failed to save cache for ${domain}:`, error.message);
  }
}

/**
 * Load schema from file cache
 * 
 * @param {string} domain - Domain name
 * @returns {Promise<Object|null>} Cached schema or null
 */
async function loadSchemaFromFile(domain) {
  try {
    const filePath = path.join(CACHE_DIR, `${domain}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist or invalid JSON
    return null;
  }
}

/**
 * List all cached schemas
 * 
 * @returns {Promise<Array>} Array of cached schema info
 */
async function listCachedSchemas() {
  try {
    const files = await fs.readdir(CACHE_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const schemas = await Promise.all(
      jsonFiles.map(async (file) => {
        const domain = file.replace('.json', '');
        const schema = await loadSchemaFromFile(domain);
        return {
          domain,
          name: schema?.name,
          generatedAt: schema?.metadata?.generatedAt,
          confidence: schema?.confidence
        };
      })
    );

    return schemas;
  } catch (error) {
    // Directory doesn't exist
    return [];
  }
}

/**
 * Clear schema cache
 * 
 * @param {string|null} domain - Domain to clear (null = clear all)
 */
async function clearSchemaCache(domain = null) {
  try {
    if (domain) {
      // Clear specific domain
      const filePath = path.join(CACHE_DIR, `${domain}.json`);
      await fs.unlink(filePath);
      console.log(`   🗑️  Cleared cache for ${domain}`);
      
      // Also clear from memory
      schemaCache.delete(domain);
    } else {
      // Clear all cache
      const files = await fs.readdir(CACHE_DIR);
      await Promise.all(
        files.map(file => fs.unlink(path.join(CACHE_DIR, file)))
      );
      console.log('   🗑️  Cleared all cache');
      
      // Clear memory cache
      schemaCache.clear();
    }
  } catch (error) {
    console.error('   ⚠️  Failed to clear cache:', error.message);
  }
}

/**
 * Refine schema based on validation failures
 * 
 * @param {Object} schema - Original schema
 * @param {string} html - HTML sample
 * @param {Object} validationResult - Validation result from testSchemaOnHTML
 * @param {string} query - Original query
 * @returns {Promise<Object>} Refined schema
 */
async function refineSchema(schema, html, validationResult, query) {
  console.log('   🔧 Attempting schema refinement...');
  
  // Build refinement prompt with specific feedback
  const issues = [];
  
  if (!validationResult.baseSelectorValid) {
    issues.push(`- Base selector "${schema.baseSelector}" found 0 items`);
  } else if (validationResult.itemsFound < 3) {
    issues.push(`- Base selector only found ${validationResult.itemsFound} items (expected more)`);
  }
  
  validationResult.fieldResults?.forEach(field => {
    if (!field.found) {
      issues.push(`- Field "${field.name}" selector "${field.selector}" not found`);
    }
  });
  
  const refinementPrompt = `You previously generated a CSS extraction schema, but it has issues. Please fix it.

ORIGINAL QUERY: ${query}

CURRENT SCHEMA:
${JSON.stringify(schema, null, 2)}

ISSUES FOUND:
${issues.join('\n')}

HTML SAMPLE:
${preprocessHTML(html)}

TASK:
Generate an IMPROVED schema that fixes these issues. Focus on:
1. Finding a better baseSelector that matches more items
2. Using simpler, more robust CSS selectors
3. Making selectors relative to the baseSelector

OUTPUT FORMAT (JSON only, no explanation):
{
  "name": "Descriptive name",
  "baseSelector": "CSS selector for container",
  "fields": [
    {
      "name": "field_name",
      "selector": "CSS selector relative to baseSelector",
      "type": "text|attribute|number",
      "attribute": "href|src|etc (only if type is attribute)"
    }
  ],
  "pagination": {
    "type": "query|path|none",
    "pattern": "URL pattern"
  }
}

Generate the IMPROVED schema:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a web scraping expert. Fix the schema issues. Output only valid JSON." },
        { role: "user", content: refinementPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content.trim();
    
    // Extract JSON from response
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }
    
    const refinedSchema = JSON.parse(jsonStr);
    
    console.log('   ✅ Schema refined');
    
    return refinedSchema;
  } catch (error) {
    console.error('   ⚠️  Refinement failed:', error.message);
    return schema; // Return original if refinement fails
  }
}

/**
 * Generate CSS extraction schema using LLM
 * 
 * @param {string} ariaTree - Accessibility tree from page.snapshot()
 * @param {string} htmlSample - HTML sample from page
 * @param {string} query - What data to extract
 * @param {string} url - Current page URL
 * @returns {Promise<Object>} Generated CSS schema
 */
/**
 * Generate CSS extraction schema using LLM
 * 
 * @param {string} ariaTree - Accessibility tree from page.snapshot()
 * @param {string} htmlSample - HTML sample from page
 * @param {string} query - What data to extract
 * @param {string} url - Current page URL
 * @returns {Promise<Object>} Generated CSS schema with validation and metadata
 */
export async function generateCssSchema(ariaTree, htmlSample, query, url) {
  const domain = new URL(url).hostname;
  
  // Check memory cache first
  if (schemaCache.has(domain)) {
    console.log(`   ♻️  Using cached schema from memory for ${domain}`);
    return schemaCache.get(domain);
  }
  
  // Check file cache
  const cachedSchema = await loadSchemaFromFile(domain);
  if (cachedSchema) {
    console.log(`   ♻️  Using cached schema from file for ${domain}`);
    schemaCache.set(domain, cachedSchema); // Load into memory
    return cachedSchema;
  }
  
  console.log(`   🤖 Generating CSS schema with LLM for ${domain}...`);
  
  // Preprocess HTML
  const processedHTML = preprocessHTML(htmlSample);
  const processedAria = ariaTree.substring(0, 3000);
  
  console.log(`   📊 HTML: ${htmlSample.length} → ${processedHTML.length} bytes`);
  
  const prompt = `You are an expert web scraping assistant. Analyze the provided HTML structure and generate a CSS-based extraction schema.

ARIA TREE (Accessibility Tree):
${processedAria}...

HTML SAMPLE:
${processedHTML}

USER QUERY: ${query}

TASK:
Generate a JSON schema with CSS selectors to extract the requested data. The schema should:
1. Identify the container element that repeats for each item
2. Provide CSS selectors for each field to extract
3. Use CSS selectors, NOT XPath (CSS works across pages)
4. Be generic enough to work on similar pages

OUTPUT FORMAT (JSON only, no explanation):
{
  "name": "Descriptive name for the data (e.g., 'Product Listings')",
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

FIELD TYPES:
- text: Extract textContent
- attribute: Extract HTML attribute (href, src, etc.)
- html: Extract innerHTML
- regex: Extract using regex pattern
- number: Extract and parse as number

IMPORTANT:
- baseSelector should target the repeating container element
- Field selectors should be RELATIVE to baseSelector
- Use simple, robust CSS selectors (prefer classes over complex combinators)
- Return ONLY valid JSON, no markdown, no explanation

GENERATE THE SCHEMA:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a web scraping expert. Output only valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content.trim();
    
    // Extract JSON from response
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }
    
    const rawSchema = JSON.parse(jsonStr);
    
    // Validate schema structure
    const validation = validateSchema(rawSchema);
    if (!validation.valid) {
      console.warn('   ⚠️  Schema validation failed:', validation.errors);
      // Continue anyway, but log warnings
    }
    
    // Test schema against HTML
    const testResult = testSchemaOnHTML(rawSchema, htmlSample);
    
    // Calculate confidence score
    let confidence = calculateConfidence(testResult);
    let finalSchema = rawSchema;
    let refinementAttempts = 0;
    const MAX_REFINEMENT_ATTEMPTS = 2;
    const MIN_CONFIDENCE_THRESHOLD = 0.7;
    
    // Attempt refinement if confidence is low
    if (confidence < MIN_CONFIDENCE_THRESHOLD && refinementAttempts < MAX_REFINEMENT_ATTEMPTS) {
      console.log(`   ⚠️  Low confidence (${(confidence * 100).toFixed(1)}%), attempting refinement...`);
      
      while (confidence < MIN_CONFIDENCE_THRESHOLD && refinementAttempts < MAX_REFINEMENT_ATTEMPTS) {
        refinementAttempts++;
        console.log(`   🔄 Refinement attempt ${refinementAttempts}/${MAX_REFINEMENT_ATTEMPTS}`);
        
        // Refine schema
        const refinedSchema = await refineSchema(finalSchema, htmlSample, testResult, query);
        
        // Validate refined schema
        const refinedValidation = validateSchema(refinedSchema);
        const refinedTestResult = testSchemaOnHTML(refinedSchema, htmlSample);
        const refinedConfidence = calculateConfidence(refinedTestResult);
        
        console.log(`      Refined confidence: ${(refinedConfidence * 100).toFixed(1)}%`);
        
        // Use refined schema if it's better
        if (refinedConfidence > confidence) {
          finalSchema = refinedSchema;
          confidence = refinedConfidence;
          testResult.baseSelectorValid = refinedTestResult.baseSelectorValid;
          testResult.itemsFound = refinedTestResult.itemsFound;
          testResult.fieldResults = refinedTestResult.fieldResults;
          validation.valid = refinedValidation.valid;
          validation.errors = refinedValidation.errors;
          
          console.log(`      ✅ Improvement: ${(confidence * 100).toFixed(1)}%`);
          
          if (confidence >= MIN_CONFIDENCE_THRESHOLD) {
            console.log(`      🎯 Confidence threshold reached!`);
            break;
          }
        } else {
          console.log(`      ⚠️  No improvement, keeping original`);
          break;
        }
      }
    }
    
    console.log(`   ✅ Schema ${refinementAttempts > 0 ? 'refined' : 'generated'} successfully!`);
    console.log(`      Base selector: ${finalSchema.baseSelector}`);
    console.log(`      Fields: ${finalSchema.fields.length}`);
    console.log(`      Items found: ${testResult.itemsFound}`);
    console.log(`      Confidence: ${(confidence * 100).toFixed(1)}%`);
    console.log(`      Pagination: ${finalSchema.pagination?.type || 'none'}`);
    if (refinementAttempts > 0) {
      console.log(`      Refinement attempts: ${refinementAttempts}`);
    }
    
    // Build final schema with metadata
    const schema = {
      ...finalSchema,
      confidence,
      validation: {
        structureValid: validation.valid,
        errors: validation.errors,
        ...testResult
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        url,
        query,
        model: 'gpt-4o-mini',
        htmlSize: htmlSample.length,
        processedSize: processedHTML.length,
        refinementAttempts
      }
    };
    
    // Cache schema (memory + file)
    schemaCache.set(domain, schema);
    await saveSchemaToFile(domain, schema);
    
    return schema;
  } catch (error) {
    console.error(`   ❌ Schema generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Extract data using generated schema
 * 
 * @param {Object} page - Playwright/Stagehand page object
 * @param {Object} schema - CSS schema object
 * @returns {Promise<Array>} Extracted items
 */
export async function extractWithSchema(page, schema) {
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
          
          // Apply transformation
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
      
      if (Object.keys(item).length > 0) {
        items.push(item);
      }
    }
    
    return items;
  }, schema);
}

/**
 * Extract data with schema and calculate post-extraction confidence
 * 
 * @param {Object} page - Playwright/Stagehand page object
 * @param {Object} schema - CSS schema object
 * @returns {Promise<Object>} { items, confidence, itemCount }
 */
export async function extractWithSchemaAndConfidence(page, schema) {
  const items = await extractWithSchema(page, schema);
  const postConfidence = calculatePostExtractionConfidence(schema, items);
  
  return {
    items,
    confidence: postConfidence,
    itemCount: items.length,
    preExtractionConfidence: schema.confidence || 0,
    finalConfidence: (postConfidence * 0.7) + ((schema.confidence || 0) * 0.3) // Weighted average
  };
}

/**
 * Detect pagination on current page
 * 
 * @param {Object} page - Playwright/Stagehand page object
 * @returns {Promise<Object>} Pagination information
 */
export async function detectPagination(page) {
  return await page.evaluate(() => {
    // Look for common pagination patterns
    const patterns = [
      { selector: 'a[href*="?p="], a[href*="&p="]', type: 'query', param: 'p' },
      { selector: 'a[href*="?page="], a[href*="&page="]', type: 'query', param: 'page' },
      { selector: 'a[href*="/page/"]', type: 'path', pattern: '/page/' },
      { selector: '.next, .pagination a, a[rel="next"]', type: 'link' },
    ];
    
    for (const pattern of patterns) {
      const links = document.querySelectorAll(pattern.selector);
      if (links.length > 0) {
        const href = links[0].getAttribute('href');
        return {
          found: true,
          type: pattern.type,
          param: pattern.param,
          pattern: pattern.pattern,
          sample: href,
        };
      }
    }
    
    return { found: false };
  });
}

/**
 * Get cached schema for domain
 * Checks both memory and file cache
 * 
 * @param {string} domain - Domain name
 * @returns {Promise<Object|null>} Cached schema or null
 */
export async function getCachedSchema(domain) {
  // Check memory first
  if (schemaCache.has(domain)) {
    return schemaCache.get(domain);
  }
  
  // Check file cache
  const fileSchema = await loadSchemaFromFile(domain);
  if (fileSchema) {
    schemaCache.set(domain, fileSchema); // Load into memory
    return fileSchema;
  }
  
  return null;
}

// Export new utility functions
export {
  validateSchema,
  testSchemaOnHTML,
  calculateConfidence,
  calculatePostExtractionConfidence,
  preprocessHTML,
  saveSchemaToFile,
  loadSchemaFromFile,
  listCachedSchemas,
  clearSchemaCache,
  refineSchema
};

