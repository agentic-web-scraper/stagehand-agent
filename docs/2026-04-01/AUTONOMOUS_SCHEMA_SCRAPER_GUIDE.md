# Autonomous Schema-Based Scraper Guide

**The ultimate web scraper: Combines autonomous agent + LLM-generated schemas**

Last Updated: April 1, 2026

---

## Overview

This scraper combines two powerful approaches:
1. **Autonomous Agent**: Makes decisions, navigates, searches
2. **LLM Schema Generation**: Creates reusable CSS selectors automatically

The result: A scraper that can find websites, understand their structure, and extract data - all autonomously!

---

## Quick Start

### Mode 1: Direct Scraping (Recommended)

Fast and efficient - provide URL directly:

```bash
node tests/autonomous_schema_scraper.js \
  --url "https://news.ycombinator.com" \
  --prompt "Extract posts with title, url, points, author, time" \
  --pages 3
```

**How it works:**
1. Loads the URL
2. Generates CSS schema with LLM
3. Extracts data using schema
4. Handles pagination automatically
5. Saves schema for reuse

### Mode 2: Agent Mode (Full Autonomy)

Let the agent use tools to scrape:

```bash
node tests/autonomous_schema_scraper.js \
  --url "https://news.ycombinator.com" \
  --prompt "Extract posts with title, url, points, author, time" \
  --agent \
  --steps 50
```

**How it works:**
1. Agent analyzes the task
2. Calls `generateSchema` tool
3. Calls `detectPagination` tool
4. Calls `extractWithSchema` tool
5. Navigates to next pages if needed
6. Returns all extracted data

### Mode 3: Search + Agent Mode

No URL needed - agent searches and scrapes:

```bash
node tests/autonomous_schema_scraper.js \
  --prompt "Find Python tutorial sites and extract article titles" \
  --agent
```

**How it works:**
1. Agent calls `searxngSearch` tool
2. Analyzes search results
3. Navigates to best URLs
4. Generates schemas for each domain
5. Extracts data from all sites

---

## Agent Tools

When using `--agent` flag, the agent has access to these tools:

### 1. generateSchema

**Purpose**: Generate CSS extraction schema using LLM

**Input**:
```javascript
{
  query: "Extract posts with title, url, points, author"
}
```

**Output**:
```javascript
{
  success: true,
  schema: {
    baseSelector: "tr.athing",
    fields: [
      {name: "title", selector: "td.title > a", type: "text"},
      {name: "url", selector: "td.title > a", type: "attribute", attribute: "href"}
    ],
    pagination: {type: "query", pattern: "?p={page}"}
  },
  message: "Schema generated with 5 fields..."
}
```

**When to use**: First step - analyze page structure

### 2. extractWithSchema

**Purpose**: Extract data using a generated schema

**Input**:
```javascript
{
  schema: {
    baseSelector: "tr.athing",
    fields: [...],
    pagination: {...}
  }
}
```

**Output**:
```javascript
{
  success: true,
  items: [
    {title: "Post 1", url: "https://..."},
    {title: "Post 2", url: "https://..."}
  ],
  count: 30,
  message: "Successfully extracted 30 items..."
}
```

**When to use**: After generating schema - extract actual data

### 3. detectPagination

**Purpose**: Detect pagination patterns on current page

**Input**: `{}` (no parameters)

**Output**:
```javascript
{
  success: true,
  found: true,
  type: "query",
  param: "p",
  sample: "?p=2",
  message: "Pagination detected. Type: query..."
}
```

**When to use**: After generating schema - check if multiple pages exist

### 4. searxngSearch

**Purpose**: Search web for relevant URLs

**Input**:
```javascript
{
  query: "Python tutorials",
  maxResults: 10
}
```

**Output**:
```javascript
{
  success: true,
  count: 10,
  results: [
    {title: "...", url: "https://...", snippet: "..."},
    ...
  ]
}
```

**When to use**: When no URL provided - find relevant sites

---

## Command-Line Options

```
-p, --prompt <text>       What data to extract (required)
-u, --url <url>           URL to scrape (optional)
--pages <number>          Max pages to scrape (default: 2)
-s, --steps <number>      Max agent steps (default: 50)
-a, --agent               Use agent mode with tools
-h, --help                Show help message
```

---

## Examples

### Example 1: Hacker News (Direct Mode)

```bash
node tests/autonomous_schema_scraper.js \
  --url "https://news.ycombinator.com" \
  --prompt "Extract posts with title, url, points, author, time" \
  --pages 3
```

**Output**:
- 90 posts from 3 pages
- Schema saved for reuse
- ~10 seconds total

### Example 2: Hacker News (Agent Mode)

```bash
node tests/autonomous_schema_scraper.js \
  --url "https://news.ycombinator.com" \
  --prompt "Extract posts with title, url, points, author, time" \
  --agent \
  --steps 50
```

**Agent workflow**:
1. Calls `generateSchema({query: "Extract posts..."})`
2. Calls `detectPagination({})`
3. Calls `extractWithSchema({schema: ...})`
4. Navigates to page 2
5. Calls `extractWithSchema({schema: ...})` again
6. Returns all items

### Example 3: Search + Scrape (Agent Mode)

```bash
node tests/autonomous_schema_scraper.js \
  --prompt "Find React documentation sites and extract main topics" \
  --agent \
  --steps 100
```

**Agent workflow**:
1. Calls `searxngSearch({query: "React documentation", maxResults: 5})`
2. Analyzes results
3. Navigates to best URL (e.g., react.dev)
4. Calls `generateSchema({query: "Extract main topics"})`
5. Calls `extractWithSchema({schema: ...})`
6. Returns extracted data

### Example 4: E-commerce (Direct Mode)

```bash
node tests/autonomous_schema_scraper.js \
  --url "http://books.toscrape.com" \
  --prompt "Extract books with title, price, rating, availability" \
  --pages 5
```

**Output**:
- 100 books from 5 pages
- Schema with 4 fields
- Pagination pattern detected automatically

---

## Comparison: Direct vs Agent Mode

### Direct Mode

**Pros**:
- ✅ Faster (no agent overhead)
- ✅ More predictable
- ✅ Lower cost (fewer LLM calls)
- ✅ Better for known URLs

**Cons**:
- ❌ Less flexible
- ❌ Can't search for URLs
- ❌ Fixed pagination logic

**Use when**:
- You know the URL
- You want speed
- You want predictability

### Agent Mode

**Pros**:
- ✅ Fully autonomous
- ✅ Can search for URLs
- ✅ Adapts to complex sites
- ✅ Uses tools intelligently

**Cons**:
- ❌ Slower (agent thinking time)
- ❌ More LLM calls (higher cost)
- ❌ Less predictable

**Use when**:
- You don't know the URL
- Site has complex navigation
- You want full autonomy

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER PROVIDES                            │
│                                                              │
│  • Prompt: "Extract posts with title, url, points"         │
│  • URL (optional)                                            │
│  • Mode: --agent or direct                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │   AGENT MODE?           │
        └────┬────────────────┬───┘
             │ YES            │ NO
             │                │
┌────────────▼──────────┐    │
│   AGENT WITH TOOLS    │    │
│                       │    │
│ Tools:                │    │
│ • generateSchema      │    │
│ • extractWithSchema   │    │
│ • detectPagination    │    │
│ • searxngSearch       │    │
│                       │    │
│ Agent decides:        │    │
│ 1. Which tools to use │    │
│ 2. When to use them   │    │
│ 3. How to combine     │    │
└────────────┬──────────┘    │
             │                │
             │    ┌───────────▼──────────┐
             │    │   DIRECT MODE        │
             │    │                      │
             │    │ 1. Load URL          │
             │    │ 2. Generate schema   │
             │    │ 3. Detect pagination │
             │    │ 4. Extract data      │
             │    │ 5. Loop pages        │
             │    └───────────┬──────────┘
             │                │
             └────────────────▼
┌─────────────────────────────────────────────────────────────┐
│                    RESULTS                                   │
│                                                              │
│  • Extracted data (JSON)                                     │
│  • Generated schemas (cached)                                │
│  • Execution stats                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Schema Caching

Schemas are cached per domain to avoid redundant LLM calls:

```javascript
// First scrape of domain
const schema = await generateCssSchema(...);  // LLM call (~$0.001)
schemaCache.set('news.ycombinator.com', schema);

// Future scrapes of same domain
const schema = schemaCache.get('news.ycombinator.com');  // No LLM call ($0)
```

**Benefits**:
- First scrape: 1 LLM call per domain
- Future scrapes: 0 LLM calls
- Schemas saved to disk for reuse across runs

---

## Output Files

### Data File

`results/autonomous_schema_TIMESTAMP.json` (Direct mode)
`results/autonomous_agent_TIMESTAMP.json` (Agent mode)

```json
{
  "timestamp": "2026-04-01T12:00:00.000Z",
  "url": "https://news.ycombinator.com",
  "prompt": "Extract posts with title, url, points, author, time",
  "method": "Autonomous Schema-Based Scraper",
  "mode": "direct",
  "totalItems": 90,
  "data": [
    {
      "title": "EmDash – a spiritual successor to WordPress",
      "url": "https://blog.cloudflare.com/emdash-wordpress/",
      "points": 234,
      "author": "user123",
      "time": "2 hours ago",
      "source": "https://news.ycombinator.com",
      "domain": "news.ycombinator.com"
    },
    ...
  ]
}
```

### Schema File

`results/autonomous_schemas_TIMESTAMP.json`

```json
{
  "news.ycombinator.com": {
    "baseSelector": "tr.athing",
    "fields": [
      {
        "name": "title",
        "selector": "td.title > span.titleline > a",
        "type": "text",
        "transform": "trim"
      },
      ...
    ],
    "pagination": {
      "type": "query",
      "pattern": "?p={page}"
    }
  }
}
```

---

## Best Practices

### 1. Start with Direct Mode

Test with direct mode first to verify the scraper works:

```bash
# Test first
node tests/autonomous_schema_scraper.js \
  --url "https://example.com" \
  --prompt "Extract items" \
  --pages 1

# Then scale up
node tests/autonomous_schema_scraper.js \
  --url "https://example.com" \
  --prompt "Extract items" \
  --pages 10
```

### 2. Use Clear Prompts

**Good**:
```
"Extract blog posts with title, author, date, excerpt, and read time"
```

**Bad**:
```
"Get posts"
```

### 3. Reuse Schemas

Save schemas and reuse them:

```bash
# First run: generates schema
node tests/autonomous_schema_scraper.js --url "..." --prompt "..."

# Schema saved to results/autonomous_schemas_*.json

# Future runs: schema is cached automatically
```

### 4. Adjust Steps for Complex Sites

```bash
# Simple site: 20-50 steps
--steps 50

# Complex site: 100+ steps
--steps 150
```

### 5. Monitor Agent Thinking

Use verbose mode to see agent decisions:

```bash
# In code, set verbose: 1
stagehand = new Stagehand({
  verbose: 1,  // Shows agent thinking
  ...
});
```

---

## Troubleshooting

### Problem: Agent doesn't use tools

**Solution**: Check system prompt and ensure tools are registered:

```javascript
const tools = {
  generateSchema: generateSchemaToolFactory(page, url),
  extractWithSchema: extractWithSchemaToolFactory(page),
  detectPagination: detectPaginationToolFactory(page),
};

const agent = stagehand.agent({
  tools: tools,  // Make sure tools are passed
  ...
});
```

### Problem: Schema generation fails

**Solution**: Check Azure OpenAI credentials:

```bash
# .env file
AZURE_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com
```

### Problem: No items extracted

**Solution**: Test schema manually:

```javascript
// In browser console
const containers = document.querySelectorAll(schema.baseSelector);
console.log('Containers found:', containers.length);
```

### Problem: Pagination not working

**Solution**: Check pagination detection:

```javascript
const pagination = await detectPagination(page);
console.log('Pagination:', pagination);
```

---

## Cost Analysis

### Direct Mode

- Schema generation: 1 LLM call per domain (~$0.001)
- Extraction: 0 LLM calls ($0)
- **Total: ~$0.001 per domain**

### Agent Mode

- Agent thinking: ~5-10 LLM calls (~$0.005-$0.01)
- Schema generation: 1 LLM call (~$0.001)
- Tool calls: Included in agent thinking
- **Total: ~$0.006-$0.011 per run**

### Comparison

- Direct mode: 10x cheaper
- Agent mode: More flexible, autonomous

---

## Summary

### Key Features

✅ **LLM-generated schemas** - No hardcoded selectors
✅ **Schema caching** - One LLM call per domain
✅ **Autonomous agent** - Makes decisions with tools
✅ **Multi-page scraping** - Automatic pagination
✅ **Search integration** - Find URLs with SearXNG
✅ **Flexible modes** - Direct or agent-driven

### When to Use

**Direct Mode**:
- Known URLs
- Speed is priority
- Cost-effective

**Agent Mode**:
- Unknown URLs (search needed)
- Complex navigation
- Full autonomy desired

---

## Related Documentation

- [LLM CSS Schema Generation Guide](./LLM_CSS_SCHEMA_GENERATION_GUIDE.md)
- [Agent-Based Scraping Guide](./AGENT_BASED_SCRAPING_GUIDE.md)
- [Schema-Based Pagination Guide](./SCHEMA_BASED_PAGINATION_GUIDE.md)

---

**Last Updated:** April 1, 2026  
**Test File:** `tests/autonomous_schema_scraper.js`  
**Combines:** Autonomous Agent + LLM Schema Generation
