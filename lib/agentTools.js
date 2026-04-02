/**
 * Agent Tools for Autonomous Scraping
 * 
 * Provides tools that the agent can use to scrape websites autonomously
 */

import { tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import { 
  generateCssSchema, 
  extractWithSchema, 
  extractWithSchemaAndConfidence,
  detectPagination 
} from './generateSchemaUtil.js';
import { searchUrls } from './searchUrls.js';

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * SearXNG Search Tool
 * Searches the web for relevant URLs
 */
export const searxngSearchTool = tool({
  description: "Search the web using SearXNG to find relevant URLs. Returns a list of search results with titles, URLs, and snippets.",
  inputSchema: z.object({
    query: z.string().describe("The search query string"),
    maxResults: z.number().optional().describe("Maximum number of search results to return"),
  }),
  execute: async ({ query, maxResults }) => {
    try {
      const numResults = maxResults || 10;
      log(`   🔍 Searching SearXNG for: "${query}"`, "blue");
      
      const result = await searchUrls(query, numResults);

      if (!result.success) {
        log(`   ⚠️  Search error: ${result.error}`, "yellow");
        return {
          success: false,
          error: result.error,
          results: [],
        };
      }

      log(`   ✅ Found ${result.count} results`, "green");
      
      return result;
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

/**
 * Generate CSS Schema Tool Factory
 * Creates a tool instance for generating CSS schemas
 * 
 * @param {Object} page - Playwright/Stagehand page object
 * @param {string} currentUrl - Current page URL
 * @returns {Object} Tool instance
 */
export function generateSchemaToolFactory(page, currentUrl) {
  return tool({
    description: "Generate a CSS extraction schema using LLM by analyzing the current page structure. This schema can be reused to extract data from similar pages. The schema includes CSS selectors for each field and is automatically validated and refined if needed. Call this ONCE per domain before extracting data.",
    inputSchema: z.object({
      query: z.string().describe("What data to extract (e.g., 'Extract posts with title, url, points, author')"),
    }),
    execute: async ({ query }) => {
      try {
        log(`   🤖 Generating CSS schema...`, "yellow");
        
        // Capture page structure
        const snapshot = await page.snapshot({ includeIframes: false });
        const fullHTML = await page.evaluate(() => document.body.innerHTML);
        const htmlSample = fullHTML.substring(0, 10000);
        
        // Generate schema with validation and refinement
        const schema = await generateCssSchema(
          snapshot.formattedTree,
          htmlSample,
          query,
          currentUrl
        );
        
        log(`   ✅ Schema generated!`, "green");
        log(`      Name: ${schema.name}`, "blue");
        log(`      Base: ${schema.baseSelector}`, "blue");
        log(`      Fields: ${schema.fields.map(f => f.name).join(', ')}`, "blue");
        log(`      Confidence: ${(schema.confidence * 100).toFixed(1)}%`, schema.confidence >= 0.7 ? "green" : "yellow");
        
        // Return simplified schema for agent
        return {
          success: true,
          schema: {
            name: schema.name,
            baseSelector: schema.baseSelector,
            fields: schema.fields,
            pagination: schema.pagination
          },
          confidence: schema.confidence,
          itemsFoundInSample: schema.validation.itemsFound,
          refinementAttempts: schema.metadata.refinementAttempts,
          message: `Schema "${schema.name}" generated with ${schema.fields.length} fields. Confidence: ${(schema.confidence * 100).toFixed(1)}%. ${schema.metadata.refinementAttempts > 0 ? `Refined ${schema.metadata.refinementAttempts} time(s).` : ''} Use extractWithSchema tool to extract data.`,
        };
      } catch (error) {
        log(`   ❌ Schema generation failed: ${error.message}`, "red");
        return {
          success: false,
          error: error.message,
        };
      }
    },
  });
}

/**
 * Extract With Schema Tool Factory
 * Creates a tool instance for extracting data using a schema
 * 
 * @param {Object} page - Playwright/Stagehand page object
 * @returns {Object} Tool instance
 */
export function extractWithSchemaToolFactory(page) {
  return tool({
    description: "Extract data from the current page using a previously generated CSS schema. Returns an array of extracted items with confidence score. Use this AFTER generating a schema with generateSchema tool.",
    inputSchema: z.object({
      schema: z.object({
        name: z.string().optional(),
        baseSelector: z.string(),
        fields: z.array(z.object({
          name: z.string(),
          selector: z.string(),
          type: z.string(),
          attribute: z.string().optional(),
          transform: z.string().optional(),
        })),
        pagination: z.object({
          type: z.string(),
          pattern: z.string().optional(),
        }).optional(),
      }).describe("The CSS schema object returned by generateSchema tool"),
    }),
    execute: async ({ schema }) => {
      try {
        log(`   📊 Extracting data with schema...`, "yellow");
        
        // Use enhanced extraction with confidence
        const result = await extractWithSchemaAndConfidence(page, schema);
        
        log(`   ✅ Extracted ${result.itemCount} items`, "green");
        log(`      Post-extraction confidence: ${(result.confidence * 100).toFixed(1)}%`, result.confidence >= 0.7 ? "green" : "yellow");
        
        return {
          success: true,
          items: result.items,
          count: result.itemCount,
          confidence: result.confidence,
          finalConfidence: result.finalConfidence,
          message: `Successfully extracted ${result.itemCount} items. Post-extraction confidence: ${(result.confidence * 100).toFixed(1)}%. ${result.itemCount === 0 ? 'No items found - schema may need adjustment.' : ''}`,
        };
      } catch (error) {
        log(`   ❌ Extraction failed: ${error.message}`, "red");
        return {
          success: false,
          error: error.message,
          items: [],
          count: 0,
          confidence: 0,
        };
      }
    },
  });
}

/**
 * Detect Pagination Tool Factory
 * Creates a tool instance for detecting pagination patterns
 * 
 * @param {Object} page - Playwright/Stagehand page object
 * @returns {Object} Tool instance
 */
export function detectPaginationToolFactory(page) {
  return tool({
    description: "Detect pagination patterns on the current page. Returns information about how to navigate to next pages. Call this to understand if the site has multiple pages.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        log(`   🔍 Detecting pagination...`, "yellow");
        
        const pagination = await detectPagination(page);
        
        if (pagination.found) {
          log(`   ✅ Pagination found: ${pagination.type}`, "green");
          log(`      Sample: ${pagination.sample}`, "blue");
          
          return {
            success: true,
            found: true,
            type: pagination.type,
            param: pagination.param,
            pattern: pagination.pattern,
            sample: pagination.sample,
            message: `Pagination detected. Type: ${pagination.type}. You can navigate to next pages.`,
          };
        } else {
          log(`   ℹ️  No pagination found`, "blue");
          return {
            success: true,
            found: false,
            message: "No pagination detected on this page.",
          };
        }
      } catch (error) {
        log(`   ❌ Pagination detection failed: ${error.message}`, "red");
        return {
          success: false,
          error: error.message,
          found: false,
        };
      }
    },
  });
}
