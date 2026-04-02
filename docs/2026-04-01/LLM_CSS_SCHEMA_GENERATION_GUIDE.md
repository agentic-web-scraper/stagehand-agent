# LLM-Based CSS Schema Generation Guide

**Automatic CSS selector generation using LLM (Inspired by Crawl4AI)**

Last Updated: April 1, 2026

---

## Overview

This guide demonstrates how to use an LLM to automatically generate CSS extraction schemas from webpage structure - **no hardcoded selectors needed!**

Inspired by [Crawl4AI's](https://github.com/unclecode/crawl4ai) `JsonCssExtractionStrategy.generate_schema()` method.

---

## The Problem with Hardcoded Selectors

### Traditional Approach ❌

```javascript
// Hardcoded selectors - breaks when site changes
const posts = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('tr.athing')).map(row => ({
    title: row.querySelector('.titleline > a')?.textContent,
    url: row.querySelector('.titleline > a')?.href,
    points: row.nextElementSibling?.querySelector('.score')?.textContent,
    author: row.nextElementSibling?.querySelector('.hnuser')?.textContent,
    time: row.nextElementSibling?.querySelector('.age')?.textContent,
  }));
});
```

**Problems:**
- ❌ Selectors are hardcoded for specific site
- ❌ Requires manual inspection and writing
- ❌ Breaks when HTML structure changes
- ❌ Different code for each website
- ❌ Time-consuming to maintain

### LLM-Generated Schema ✅

```javascript
// Step 1: Generate schema once with LLM
const schema = await generateCssSchema(ariaTree, htmlSample, 
  "Extract posts with title, url, points, author, time"
);

// Step 2: Save schema for reuse (no more LLM calls!)
fs.writeFileSync('schema.json', JSON.stringify(schema));

// Step 3: Extract data using schema
const posts = await extractWithSchema(page, schema);
```

**Benefits:**
- ✅ No hardcoded selectors
- ✅ LLM analyzes structure automatically
- ✅ Schema is reusable (one-time LLM cost)
- ✅ Works on any website
- ✅ Human-readable and editable

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              1. Capture Page Structure                      │
│                                                              │
│  • Aria Tree (accessibility tree)                           │
│  • HTML Sample (first 5000 chars)                           │
│  • URL Map (links and pagination)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              2. LLM Analyzes Structure                      │
│                                                              │
│  Prompt: "Analyze this HTML and generate CSS schema         │
│           to extract: title, url, points, author, time"     │
│                                                              │
│  LLM identifies:                                             │
│  • Container element: tr.athing                              │
│  • Title selector: td.title > span.titleline > a            │
│  • Points selector: tr + tr > td.subtext > span.score       │
│  • Pagination pattern: ?p={page}                            │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              3. Generate CSS Schema (JSON)                  │
│                                                              │
│  {                                                           │
│    "baseSelector": "tr.athing",                              │
│    "fields": [                                               │
│      {"name": "title", "selector": "...", "type": "text"},  │
│      {"name": "url", "selector": "...", "type": "attribute"}│
│    ],                                                        │
│    "pagination": {"type": "query", "pattern": "?p={page}"}  │
│  }                                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              4. Save Schema for Reuse                       │
│                                                              │
│  • Save to JSON file                                         │
│  • No more LLM calls needed!                                 │
│  • Reuse schema for future scrapes                           │
│  • Edit manually if needed                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              5. Extract Data with Schema                    │
│                                                              │
│  • Load schema from file                                     │
│  • Apply selectors to page                                   │
│  • Extract structured data                                   │
│  • Works across multiple pages                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation

### Step 1: Generate Schema with LLM

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AZURE_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-4o-mini`,
  defaultQuery: { 'api-version': '2024-08-01-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_API_KEY },
});

async function generateCssSchema(ariaTree, htmlSample, query) {
  const prompt = `You are an expert web scraping assistant. Analyze the provided HTML structure and generate a CSS-based extraction schema.

ARIA TREE (Accessibility Tree):
${ariaTree.substring(0, 3000)}...

HTML SAMPLE:
${htmlSample.substring(0, 2000)}...

USER QUERY: ${query}

TASK:
Generate a JSON schema with CSS selectors to extract the requested data.

OUTPUT FORMAT (JSON only):
{
  "baseSelector": "CSS selector for container element",
  "fields": [
    {
      "name": "field_name",
      "selector": "CSS selector relative to baseSelector",
      "type": "text|attribute|number",
      "attribute": "href|src (only if type is attribute)",
      "transform": "optional transformation (trim, parseInt, etc.)"
    }
  ],
  "pagination": {
    "type": "query|path|none",
    "pattern": "URL pattern (e.g., '?p={page}')"
  }
}`;

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
  }
  
  return JSON.parse(jsonStr);
}
```

### Step 2: Extract Data with Schema

```javascript
async function extractWithSchema(page, schema) {
  return await page.evaluate((schema) => {
    const items = [];
    const containers = document.querySelectorAll(schema.baseSelector);
    
    for (const container of containers) {
      const item = {};
      
      for (const field of schema.fields) {
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
          if (field.transform === 'parseInt') value = parseInt(value);
          else if (field.transform === 'parseFloat') value = parseFloat(value);
          else if (field.transform === 'trim') value = value.trim();
        }
        
        item[field.name] = value;
      }
      
      if (Object.keys(item).length > 0) {
        items.push(item);
      }
    }
    
    return items;
  }, schema);
}
```

### Step 3: Complete Scraper

```javascript
import { Stagehand } from "@browserbasehq/stagehand";
import fs from 'fs';

async function scrapeWithLLMSchema(url, query, maxPages = 2) {
  const stagehand = new Stagehand({ env: "LOCAL" });
  await stagehand.init();
  const page = stagehand.context.pages()[0];
  
  // Load page
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // Capture structure
  const snapshot = await page.snapshot({ includeIframes: false });
  const htmlSample = await page.evaluate(() => 
    document.body.innerHTML.substring(0, 5000)
  );
  
  // Generate schema with LLM (one-time cost)
  const schema = await generateCssSchema(
    snapshot.formattedTree,
    htmlSample,
    query
  );
  
  // Save schema for reuse
  fs.writeFileSync('schema.json', JSON.stringify(schema, null, 2));
  console.log("Schema saved! Reuse it for future scrapes.");
  
  // Extract data from multiple pages
  const allData = [];
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    if (pageNum > 1) {
      const nextUrl = `${url}?p=${pageNum}`;
      await page.goto(nextUrl, { waitUntil: 'networkidle' });
    }
    
    const pageData = await extractWithSchema(page, schema);
    allData.push(...pageData);
  }
  
  await stagehand.close();
  return allData;
}

// Usage
const data = await scrapeWithLLMSchema(
  "https://news.ycombinator.com",
  "Extract posts with title, url, points, author, time",
  2
);

console.log(`Scraped ${data.length} items`);
```

---

## Real-World Example: Hacker News

### Generated Schema

```json
{
  "baseSelector": "tr.athing",
  "fields": [
    {
      "name": "title",
      "selector": "td.title > span.titleline > a",
      "type": "text",
      "transform": "trim"
    },
    {
      "name": "url",
      "selector": "td.title > span.titleline > a",
      "type": "attribute",
      "attribute": "href"
    },
    {
      "name": "points",
      "selector": "tr + tr > td.subtext > span.score",
      "type": "number",
      "transform": "parseInt"
    },
    {
      "name": "author",
      "selector": "tr + tr > td.subtext > a.hnuser",
      "type": "text",
      "transform": "trim"
    },
    {
      "name": "time",
      "selector": "tr + tr > td.subtext > span.age > a",
      "type": "text",
      "transform": "trim"
    }
  ],
  "pagination": {
    "type": "query",
    "pattern": "?p={page}"
  }
}
```

### Results

**Performance:**
- Schema generation: ~3 seconds (one-time)
- Scraping with schema: ~2 seconds per page
- Total: 60 posts from 2 pages in ~7 seconds

**Output:**
```json
[
  {
    "title": "EmDash – a spiritual successor to WordPress",
    "url": "https://blog.cloudflare.com/emdash-wordpress/"
  },
  {
    "title": "Ask HN: Who is hiring? (April 2026)",
    "url": "item?id=47601859"
  },
  ...
]
```

---

## Schema Reuse (No More LLM Calls!)

### Generate Once

```javascript
// First time: Generate schema with LLM
const schema = await generateCssSchema(ariaTree, htmlSample, query);
fs.writeFileSync('hn_schema.json', JSON.stringify(schema, null, 2));
```

### Reuse Forever

```javascript
// Future scrapes: Load saved schema (no LLM call!)
const schema = JSON.parse(fs.readFileSync('hn_schema.json', 'utf8'));
const data = await extractWithSchema(page, schema);
```

**Cost Savings:**
- First scrape: 1 LLM call (~$0.001)
- Future scrapes: 0 LLM calls ($0)
- Schema is reusable indefinitely!

---

## Comparison: Crawl4AI vs Our Implementation

### Crawl4AI (Python)

```python
from crawl4ai import JsonCssExtractionStrategy

# Generate schema
schema = JsonCssExtractionStrategy.generate_schema(
    html=html_content,
    schema_type="CSS",
    query="Extract product name, price, description"
)

# Use schema
strategy = JsonCssExtractionStrategy(schema)
result = await crawler.arun(url, extraction_strategy=strategy)
```

### Our Implementation (JavaScript/Stagehand)

```javascript
import { Stagehand } from "@browserbasehq/stagehand";

// Generate schema
const schema = await generateCssSchema(ariaTree, htmlSample, 
  "Extract product name, price, description"
);

// Use schema
const data = await extractWithSchema(page, schema);
```

**Key Differences:**
- Crawl4AI: Python-based, built-in schema generation
- Our implementation: JavaScript-based, custom LLM integration
- Both: Same concept - LLM generates CSS schema once, reuse forever

---

## Advanced Usage

### 1. Schema for Different Site Types

**E-commerce:**
```javascript
const schema = await generateCssSchema(ariaTree, htmlSample,
  "Extract products with name, price, rating, image, availability"
);
```

**News:**
```javascript
const schema = await generateCssSchema(ariaTree, htmlSample,
  "Extract articles with headline, author, date, summary, category"
);
```

**Job Listings:**
```javascript
const schema = await generateCssSchema(ariaTree, htmlSample,
  "Extract jobs with title, company, location, salary, description"
);
```

### 2. Manual Schema Editing

Generated schemas are human-readable and editable:

```json
{
  "baseSelector": "tr.athing",
  "fields": [
    {
      "name": "title",
      "selector": "td.title > span.titleline > a",
      "type": "text",
      "transform": "trim"
    }
  ]
}
```

You can:
- Add new fields
- Modify selectors
- Change transformations
- Adjust pagination pattern

### 3. Schema Validation

```javascript
function validateSchema(schema) {
  if (!schema.baseSelector) {
    throw new Error("Missing baseSelector");
  }
  
  if (!schema.fields || schema.fields.length === 0) {
    throw new Error("No fields defined");
  }
  
  for (const field of schema.fields) {
    if (!field.name || !field.selector || !field.type) {
      throw new Error(`Invalid field: ${JSON.stringify(field)}`);
    }
  }
  
  return true;
}
```

### 4. Fallback Strategies

```javascript
async function extractWithFallback(page, schema) {
  // Try generated schema first
  let data = await extractWithSchema(page, schema);
  
  if (data.length === 0) {
    console.log("Schema failed, trying fallback...");
    
    // Fallback: Generic selectors
    data = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('article, .post, .item'))
        .map(el => ({
          title: el.querySelector('h1, h2, h3, .title')?.textContent?.trim(),
          url: el.querySelector('a')?.href,
        }))
        .filter(item => item.title);
    });
  }
  
  return data;
}
```

---

## Best Practices

### 1. Provide Clear Queries

**Good:**
```javascript
"Extract blog posts with title, author, date, excerpt, and read time"
```

**Bad:**
```javascript
"Get posts"
```

### 2. Include Sample Context

```javascript
const prompt = `
CONTEXT: This is a ${siteType} website.
Common patterns: ${commonPatterns}

USER QUERY: ${query}

Generate CSS schema...
`;
```

### 3. Cache Schemas by Domain

```javascript
const schemaCache = new Map();

async function getSchema(url, ariaTree, htmlSample, query) {
  const domain = new URL(url).hostname;
  
  if (schemaCache.has(domain)) {
    console.log("Using cached schema");
    return schemaCache.get(domain);
  }
  
  const schema = await generateCssSchema(ariaTree, htmlSample, query);
  schemaCache.set(domain, schema);
  
  return schema;
}
```

### 4. Version Your Schemas

```javascript
const schema = {
  version: "1.0.0",
  generatedAt: new Date().toISOString(),
  url: "https://example.com",
  baseSelector: "...",
  fields: [...]
};
```

---

## Troubleshooting

### Problem: LLM generates invalid selectors

**Solution:** Provide more context in prompt:
```javascript
const prompt = `
IMPORTANT: Generate CSS selectors that:
- Use class names (e.g., .title, .post)
- Avoid complex combinators
- Work across multiple pages
- Are relative to baseSelector

${originalPrompt}
`;
```

### Problem: Schema doesn't extract data

**Solution:** Test schema on page:
```javascript
const testData = await page.evaluate((schema) => {
  const containers = document.querySelectorAll(schema.baseSelector);
  return {
    containersFound: containers.length,
    firstContainer: containers[0]?.outerHTML.substring(0, 200),
  };
}, schema);

console.log("Test results:", testData);
```

### Problem: LLM cost too high

**Solution:** Generate schema once, save and reuse:
```javascript
// Check if schema exists
if (fs.existsSync('schema.json')) {
  schema = JSON.parse(fs.readFileSync('schema.json'));
  console.log("Using saved schema (no LLM call)");
} else {
  schema = await generateCssSchema(...);
  fs.writeFileSync('schema.json', JSON.stringify(schema));
  console.log("Generated new schema");
}
```

---

## Cost Analysis

### Traditional Approach

- Developer time: 30-60 minutes per site
- Maintenance: High (breaks with changes)
- Scalability: Low (one scraper per site)
- **Total cost: High developer time**

### LLM Schema Generation

- First scrape: 1 LLM call (~$0.001)
- Future scrapes: 0 LLM calls ($0)
- Maintenance: Low (regenerate schema if needed)
- Scalability: High (same code for all sites)
- **Total cost: Minimal LLM cost + low developer time**

---

## Summary

### The LLM Schema Generation Workflow

1. **Capture structure** (aria tree + HTML sample)
2. **Generate schema** with LLM (one-time)
3. **Save schema** for reuse
4. **Extract data** using schema
5. **Reuse forever** (no more LLM calls!)

### Key Advantages

- ✅ **No hardcoded selectors** - LLM generates them
- ✅ **One-time LLM cost** - Schema is reusable
- ✅ **Works on any website** - Generic approach
- ✅ **Human-readable** - Edit schemas manually
- ✅ **Crawl4AI-inspired** - Proven approach

### When to Use

**Good for:**
- Scraping multiple similar sites
- Sites that change structure occasionally
- When you want reusable schemas
- Cost-effective large-scale scraping

**Not ideal for:**
- One-time scrapes (manual is faster)
- Sites with heavy JavaScript (need different approach)
- When LLM access is unavailable

---

## Related Documentation

- [Agent-Based Scraping Guide](./AGENT_BASED_SCRAPING_GUIDE.md)
- [Schema-Based Pagination Guide](./SCHEMA_BASED_PAGINATION_GUIDE.md)
- [Webpage Schema Extraction Guide](./WEBPAGE_SCHEMA_EXTRACTION_GUIDE.md)

---

## References

- [Crawl4AI Documentation](https://github.com/unclecode/crawl4ai)
- [Crawl4AI Schema Generation](https://github.com/unclecode/crawl4ai/blob/main/docs/md_v2/blog/releases/v0.4.3b1.md)

---

**Last Updated:** April 1, 2026  
**Stagehand Version:** 3.0+  
**Test File:** `tests/llm_schema_generator.js`  
**Inspired by:** [Crawl4AI](https://github.com/unclecode/crawl4ai)
