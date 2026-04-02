# Schema Generator Tools for Agents

## Overview

The schema generator tools allow autonomous agents to generate CSS extraction schemas and extract data without hardcoded selectors. These tools integrate the enhanced schema generation system (with validation, confidence scoring, and refinement) into the agent workflow.

## Available Tools

### 1. generateSchema Tool

**Purpose:** Generate a CSS extraction schema by analyzing the current page structure.

**Input:**
```javascript
{
  query: "Extract books with title, price, and rating"
}
```

**Output:**
```javascript
{
  success: true,
  schema: {
    name: "Book Listings",
    baseSelector: "article.product_pod",
    fields: [
      { name: "title", selector: "h3 > a", type: "attribute", attribute: "title" },
      { name: "price", selector: ".price_color", type: "text" },
      { name: "rating", selector: "p.star-rating", type: "attribute", attribute: "class" }
    ],
    pagination: { type: "query", pattern: "page-{page}.html" }
  },
  confidence: 0.5,
  itemsFoundInSample: 0,
  refinementAttempts: 1,
  message: "Schema generated with 3 fields. Confidence: 50.0%. Refined 1 time(s)."
}
```

**Features:**
- ✅ Automatic schema generation using LLM
- ✅ Schema validation
- ✅ Confidence scoring
- ✅ Automatic refinement if confidence < 70%
- ✅ File-based caching (subsequent calls are instant)

### 2. extractWithSchema Tool

**Purpose:** Extract data from the current page using a generated schema.

**Input:**
```javascript
{
  schema: {
    name: "Book Listings",
    baseSelector: "article.product_pod",
    fields: [
      { name: "title", selector: "h3 > a", type: "attribute", attribute: "title" },
      { name: "price", selector: ".price_color", type: "text" }
    ]
  }
}
```

**Output:**
```javascript
{
  success: true,
  items: [
    { title: "A Light in the Attic", price: "£51.77" },
    { title: "Tipping the Velvet", price: "£53.74" },
    ...
  ],
  count: 20,
  confidence: 0.95,
  finalConfidence: 0.85,
  message: "Successfully extracted 20 items. Post-extraction confidence: 95.0%."
}
```

**Features:**
- ✅ Fast extraction using CSS selectors
- ✅ Post-extraction confidence calculation
- ✅ Hybrid confidence score (pre + post)
- ✅ No LLM calls (deterministic)

### 3. detectPagination Tool

**Purpose:** Detect pagination patterns on the current page.

**Input:** (none)

**Output:**
```javascript
{
  success: true,
  found: true,
  type: "query",
  param: "page",
  pattern: "?page={page}",
  sample: "?page=2",
  message: "Pagination detected. Type: query. You can navigate to next pages."
}
```

## Usage in Agents

### Basic Agent Setup

```javascript
import { Stagehand } from "@browserbasehq/stagehand";
import { 
  generateSchemaToolFactory, 
  extractWithSchemaToolFactory 
} from './lib/agentTools.js';

const stagehand = new Stagehand({
  env: "LOCAL",
  model: "azure/gpt-4o-mini",
});

await stagehand.init();
const page = stagehand.context.pages()[0];

// Create agent with tools
const agent = stagehand.agent({
  model: "azure/gpt-4o-mini",
  tools: {
    generateSchema: generateSchemaToolFactory(page, page.url()),
    extractWithSchema: extractWithSchemaToolFactory(page),
  },
  systemPrompt: `You are a web scraping agent with schema generation tools.
  
WORKFLOW:
1. Call generateSchema to create extraction schema
2. Call extractWithSchema to get data
3. Return the extracted data`,
});

// Execute
const result = await agent.execute({
  instruction: "Generate schema and extract books from this page",
  maxSteps: 20,
});
```

### Recommended System Prompt

```javascript
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
- If extraction returns 0 items, the schema may need adjustment
- Return the extracted data in your final response

CONFIDENCE INTERPRETATION:
- Pre-extraction confidence: Based on HTML sample (may be neutral ~50%)
- Post-extraction confidence: Based on actual extracted data (more reliable)
- Final confidence: Weighted average (70% post + 30% pre)
- Trust post-extraction confidence over pre-extraction`
```

## Tool Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ Agent Receives Task                                          │
│ "Extract books from this page"                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Agent Calls generateSchema Tool                     │
├─────────────────────────────────────────────────────────────┤
│ Input: { query: "Extract books with title, price" }         │
│                                                              │
│ Tool Actions:                                                │
│ • Captures page structure                                    │
│ • Calls LLM to generate schema                              │
│ • Validates schema                                           │
│ • Refines if confidence < 70%                               │
│ • Caches schema to file                                      │
│                                                              │
│ Output: { schema, confidence, refinementAttempts }           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Agent Calls extractWithSchema Tool                  │
├─────────────────────────────────────────────────────────────┤
│ Input: { schema: <from step 1> }                            │
│                                                              │
│ Tool Actions:                                                │
│ • Uses schema to find elements (CSS selectors)              │
│ • Extracts data from DOM                                     │
│ • Calculates post-extraction confidence                      │
│ • Returns items + confidence                                 │
│                                                              │
│ Output: { items, count, confidence, finalConfidence }        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Agent Returns Results                               │
│ { books: [...], count: 20, confidence: 95% }                │
└─────────────────────────────────────────────────────────────┘
```

## Examples

### Example 1: Direct Tool Usage

```javascript
// Create tools
const generateTool = generateSchemaToolFactory(page, page.url());
const extractTool = extractWithSchemaToolFactory(page);

// Generate schema
const schemaResult = await generateTool.execute({
  query: "Extract products with name and price"
});

// Extract data
const extractResult = await extractTool.execute({
  schema: schemaResult.schema
});

console.log(`Extracted ${extractResult.count} items`);
console.log(`Confidence: ${extractResult.finalConfidence}`);
```

### Example 2: Agent with Tools

```javascript
const agent = stagehand.agent({
  tools: {
    generateSchema: generateSchemaToolFactory(page, page.url()),
    extractWithSchema: extractWithSchemaToolFactory(page),
  },
});

const result = await agent.execute({
  instruction: "Extract all products from this page",
  maxSteps: 20,
});
```

### Example 3: Multi-Page Scraping

```javascript
const agent = stagehand.agent({
  tools: {
    generateSchema: generateSchemaToolFactory(page, page.url()),
    extractWithSchema: extractWithSchemaToolFactory(page),
    detectPagination: detectPaginationToolFactory(page),
  },
});

const result = await agent.execute({
  instruction: "Generate schema, extract data from first 3 pages",
  maxSteps: 50,
});
```

## Performance

| Operation | Time | Cost | Notes |
|-----------|------|------|-------|
| generateSchema (first time) | 8-10s | $0.001-0.002 | LLM call + validation |
| generateSchema (cached) | <0.1s | $0 | Loads from file |
| extractWithSchema | <0.1s | $0 | Pure JavaScript |
| Total (first run) | ~10s | ~$0.002 | Schema + extraction |
| Total (cached) | <0.2s | $0 | Instant! |

## Confidence Scores

### Pre-Extraction Confidence
- Calculated from HTML sample (8KB)
- May be neutral (~50%) if content not in sample
- Used to trigger refinement

### Post-Extraction Confidence
- Calculated from actual extracted data
- More reliable indicator
- Based on: items found, field completeness

### Final Confidence
- Weighted average: 70% post + 30% pre
- Best overall indicator
- Use this for decision making

## Best Practices

### 1. Generate Once, Extract Many
```javascript
// ✅ Good: Generate schema once
const schema = await generateTool.execute({ query: "..." });

// Extract from multiple pages
for (const url of urls) {
  await page.goto(url);
  const data = await extractTool.execute({ schema: schema.schema });
}
```

### 2. Check Confidence
```javascript
const result = await extractTool.execute({ schema });

if (result.finalConfidence < 0.7) {
  console.warn('Low confidence - review results');
}
```

### 3. Handle Failures
```javascript
if (!schemaResult.success) {
  console.error('Schema generation failed:', schemaResult.error);
  // Fallback or retry
}

if (extractResult.count === 0) {
  console.warn('No items extracted - schema may need adjustment');
}
```

### 4. Use Caching
```javascript
// First run: generates schema (slow)
// Subsequent runs: loads from cache (fast)
// Cache location: schema_cache/<domain>.json
```

## Troubleshooting

### Low Pre-Extraction Confidence
- **Normal!** Pre-extraction tests against 8KB sample
- Trust post-extraction confidence instead
- If extraction succeeds, schema is good

### No Items Extracted
- Schema may be incorrect
- Try regenerating with clearer query
- Check if page structure changed

### Schema Generation Fails
- Check Azure OpenAI credentials
- Verify page loaded correctly
- Try simpler query

## Files

- **Implementation:** `lib/agentTools.js`
- **Core Logic:** `lib/generateSchemaUtil.js`
- **Examples:** `examples/agent_with_schema_tools.js`, `examples/schema_tools_demo.js`
- **Tests:** `tests/cssSchemaGenerator.test.js`

---

**Status:** ✅ Production Ready  
**Last Updated:** April 2, 2026
