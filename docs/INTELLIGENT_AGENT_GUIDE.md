# Intelligent Autonomous Agent with Schema Generation

## Overview

The enhanced autonomous agent now intelligently chooses between two extraction strategies:

1. **Schema-based extraction** - For pages with repeating patterns (e-commerce, listings)
   - Cost: $0.002 first time, $0 cached
   - Speed: Very fast (<1s per page)
   - Best for: Product listings, search results, tables, repeated content

2. **LLM extraction** - For complex, unique pages
   - Cost: Per page
   - Speed: Moderate
   - Best for: Articles, documentation, unique layouts

## How It Works

### Intelligent Decision Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Agent navigates to page                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Call analyzePage tool                               │
├─────────────────────────────────────────────────────────────┤
│ • Counts repeating elements (articles, products, items)      │
│ • Checks for pagination                                      │
│ • Returns recommendation: useSchema = true/false             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
              ┌──────┴──────┐
              │             │
    useSchema=true    useSchema=false
              │             │
              ▼             ▼
┌─────────────────────┐  ┌──────────────────────┐
│ Schema Extraction   │  │ LLM Extraction       │
├─────────────────────┤  ├──────────────────────┤
│ 1. generateSchema   │  │ Use built-in         │
│    ($0.002 or $0)   │  │ extract() method     │
│                     │  │ (costs per page)     │
│ 2. extractWithSchema│  │                      │
│    (instant, $0)    │  │                      │
│                     │  │                      │
│ 3. Reuse schema for │  │                      │
│    pagination       │  │                      │
└─────────────────────┘  └──────────────────────┘
              │             │
              └──────┬──────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Return extracted data: {items: [...]}                       │
└─────────────────────────────────────────────────────────────┘
```

## Available Tools

### 1. analyzePage

**Purpose:** Analyze page structure to determine extraction strategy

**Returns:**
```javascript
{
  success: true,
  useSchema: true,  // Recommendation
  repeatingCount: 20,  // Number of repeating elements found
  bestSelector: "article.product_pod",
  hasPagination: true,
  reason: "Found 20 repeating elements. Schema extraction recommended."
}
```

**When agent calls it:**
- First action on any new page
- Before deciding extraction strategy

### 2. generateSchema

**Purpose:** Generate CSS extraction schema for repeating patterns

**Input:**
```javascript
{
  query: "Extract products with title, price, and rating"
}
```

**Returns:**
```javascript
{
  success: true,
  schema: { /* CSS schema */ },
  cached: false,  // true if loaded from cache
  confidence: 0.85,
  itemsFound: 20,
  message: "Schema generated with 3 fields. Confidence: 85%"
}
```

**Cost:**
- First time: $0.002 + 8-10s
- Cached: $0 + <0.1s

### 3. extractWithSchema

**Purpose:** Extract data using generated schema

**Input:**
```javascript
{
  schema: { /* from generateSchema */ }
}
```

**Returns:**
```javascript
{
  success: true,
  items: [
    { title: "Book 1", price: "$10", rating: "5 stars" },
    { title: "Book 2", price: "$15", rating: "4 stars" },
    ...
  ],
  count: 20,
  confidence: 0.95,
  message: "Successfully extracted 20 items. Confidence: 95%"
}
```

**Cost:** $0 (no LLM calls)

### 4. searxngSearch (when no URL provided)

**Purpose:** Search the web for relevant URLs

**Input:**
```javascript
{
  query: "Python tutorials",
  maxResults: 10
}
```

## Usage Examples

### Example 1: E-commerce Site (Schema Extraction)

```bash
node main/fully_autonomous_agent.js \
  --url "https://books.toscrape.com/" \
  --prompt "Extract all books with title, price, and rating" \
  --steps 30
```

**Agent workflow:**
1. ✅ Calls `analyzePage` → finds 20 articles → recommends schema
2. ✅ Calls `generateSchema` → generates CSS schema (or loads from cache)
3. ✅ Calls `extractWithSchema` → extracts 20 books instantly
4. ✅ Returns data

**Cost:** $0.002 first time, $0 cached  
**Time:** 10s first time, <1s cached

### Example 2: Complex Page (LLM Extraction)

```bash
node main/fully_autonomous_agent.js \
  --url "https://example.com/" \
  --prompt "Extract the main heading and description" \
  --steps 20
```

**Agent workflow:**
1. ✅ Calls `analyzePage` → finds 0 repeating elements → recommends LLM
2. ✅ Uses built-in `extract()` → LLM extraction
3. ✅ Returns data

**Cost:** Per page  
**Time:** Moderate

### Example 3: Search and Extract (Intelligent)

```bash
node main/fully_autonomous_agent.js \
  --prompt "Find e-commerce sites selling books and extract product info" \
  --steps 50
```

**Agent workflow:**
1. ✅ Calls `searxngSearch` → finds URLs
2. ✅ Navigates to first URL
3. ✅ Calls `analyzePage` → decides strategy
4. ✅ Extracts data (schema or LLM)
5. ✅ Repeats for other URLs
6. ✅ Returns all data

## Decision Logic

### When to Use Schema Extraction

The agent uses schema extraction when:
- ✅ Page has 5+ repeating elements
- ✅ Elements have similar structure (products, articles, listings)
- ✅ Multiple pages with same pattern (pagination)
- ✅ Cost optimization is important

**Examples:**
- E-commerce product listings
- Search results
- News article listings
- Data tables
- Directory listings

### When to Use LLM Extraction

The agent uses LLM extraction when:
- ✅ Page has <5 repeating elements
- ✅ Content is unique/complex
- ✅ One-time extraction
- ✅ Accuracy is more important than cost

**Examples:**
- Single article pages
- Documentation pages
- About pages
- Contact pages
- Unique layouts

## Cost Comparison

### Scenario: Extract 100 products from 5 pages (20 products each)

**Schema Extraction:**
```
Page 1: Generate schema ($0.002) + Extract ($0) = $0.002
Page 2: Extract with cached schema ($0) = $0
Page 3: Extract with cached schema ($0) = $0
Page 4: Extract with cached schema ($0) = $0
Page 5: Extract with cached schema ($0) = $0
─────────────────────────────────────────────
Total: $0.002 (100 products)
Time: ~10s first page, <1s per subsequent page
```

**LLM Extraction:**
```
Page 1: LLM extract (~$0.01) = $0.01
Page 2: LLM extract (~$0.01) = $0.01
Page 3: LLM extract (~$0.01) = $0.01
Page 4: LLM extract (~$0.01) = $0.01
Page 5: LLM extract (~$0.01) = $0.01
─────────────────────────────────────────────
Total: ~$0.05 (100 products)
Time: Moderate per page
```

**Savings:** 96% cost reduction with schema extraction!

## System Prompt

The agent has an intelligent system prompt that guides decision-making:

```
INTELLIGENT EXTRACTION WORKFLOW:
1. ANALYZE: Call analyzePage to check if page has repeating patterns
2. DECIDE:
   - If useSchema=true (5+ repeating items): Use schema-based extraction
   - If useSchema=false (complex page): Use built-in extract()
3. EXTRACT: Get all data from current page
4. PAGINATE: If page has pagination, navigate and repeat
5. RETURN: All extracted data in {items: [...]} format

COST OPTIMIZATION:
- Schema extraction: Generate once ($0.002), extract many times ($0)
- LLM extraction: Every page costs money
- Use schema for e-commerce, listings, tables, repeated patterns
- Use LLM for complex, unique content
```

## Testing

### Run Test Suite

```bash
bash examples/test_intelligent_agent.sh
```

This will test:
1. E-commerce site (schema extraction)
2. Complex page (LLM extraction)
3. Search and extract (intelligent decision)

### Manual Testing

```bash
# Test with e-commerce site
node main/fully_autonomous_agent.js \
  --url "https://books.toscrape.com/" \
  --prompt "Extract books" \
  --steps 30

# Test with search
node main/fully_autonomous_agent.js \
  --prompt "Find Python tutorial sites" \
  --steps 50
```

## Output Format

Results are saved to `results/autonomous_agent_<timestamp>.json`:

```json
{
  "timestamp": "2026-04-02T...",
  "url": "https://books.toscrape.com/",
  "prompt": "Extract all books",
  "method": "Fully Autonomous Agent with Intelligent Extraction",
  "features": {
    "searchEnabled": false,
    "intelligentExtraction": true,
    "schemaGeneration": true,
    "costOptimization": true
  },
  "totalItems": 20,
  "executionTime": "12s",
  "items": [
    { "title": "Book 1", "price": "$10", ... },
    ...
  ]
}
```

## Benefits

### 1. Cost Optimization
- 96% cost reduction for repeated patterns
- Automatic caching and reuse
- Smart decision-making

### 2. Speed
- Schema extraction: <1s per page (cached)
- Pagination: Instant with cached schema
- No redundant LLM calls

### 3. Accuracy
- Schema: 85-95% confidence
- LLM: High accuracy for complex pages
- Best tool for each job

### 4. Autonomous
- Agent makes all decisions
- No manual intervention
- Adapts to any site structure

## Troubleshooting

### Agent always uses LLM extraction

**Cause:** Page doesn't have enough repeating elements (<5)

**Solution:** 
- Check if page actually has repeated patterns
- Adjust threshold in `createPageAnalysisTool` if needed

### Schema generation fails

**Cause:** Azure OpenAI credentials or HTML structure issues

**Solution:**
- Check `.env` file for credentials
- Verify page loaded correctly
- Check logs for specific error

### Low confidence scores

**Cause:** Schema doesn't match page structure well

**Solution:**
- Agent will automatically refine schema
- If still low, agent should fall back to LLM
- Check if page structure is unusual

## Advanced Configuration

### Adjust Repeating Element Threshold

In `createPageAnalysisTool`, change:

```javascript
const useSchema = analysis.repeatingCount >= 5;  // Change 5 to your threshold
```

### Add Custom Selectors

In `createPageAnalysisTool`, add to selectors array:

```javascript
const selectors = [
  'article',
  '.product',
  '.your-custom-selector',  // Add here
  ...
];
```

## Files

- **Main:** `main/fully_autonomous_agent.js`
- **Schema Utils:** `lib/generateSchemaUtil.js`
- **Agent Tools:** `lib/agentTools.js`
- **Tests:** `examples/test_intelligent_agent.sh`
- **Results:** `results/autonomous_agent_*.json`

---

**Status:** ✅ Production Ready  
**Last Updated:** April 2, 2026
