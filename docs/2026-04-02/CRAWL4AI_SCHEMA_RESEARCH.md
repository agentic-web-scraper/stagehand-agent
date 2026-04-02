# Crawl4AI CSS Schema Generation Research

**How Crawl4AI implements LLM-based CSS schema generation**

Research Date: April 2, 2026

---

## Overview

Crawl4AI uses `JsonCssExtractionStrategy.generate_schema()` to automatically generate CSS extraction schemas using LLMs. This eliminates manual CSS selector writing.

---

## Key Concepts

### 1. Schema Structure

Crawl4AI uses a specific schema format:

```json
{
  "name": "Schema Name",
  "baseSelector": "div.item",
  "fields": [
    {
      "name": "field_name",
      "selector": "h2.title",
      "type": "text|attribute|html|regex",
      "attribute": "href",
      "pattern": "\\d+",
      "transform": "function_name",
      "default": "default_value"
    }
  ]
}
```

### 2. Field Types

- **text**: Extract text content
- **attribute**: Extract HTML attribute value (requires `attribute` field)
- **html**: Extract HTML block
- **regex**: Extract using regex pattern (requires `pattern` field)

### 3. Schema Generation Method

```python
schema = JsonCssExtractionStrategy.generate_schema(
    html=html_content,
    schema_type="CSS",  # or "XPATH"
    query="Extract product name, price, and description",
    llm_config=LLMConfig(
        provider="openai/gpt-4o-mini",
        api_token="env:OPENAI_API_KEY"
    )
)
```

**Parameters:**
- `html`: HTML content to analyze
- `schema_type`: "CSS" or "XPATH"
- `query`: Natural language description of what to extract
- `llm_config`: LLM configuration (provider, API key)

---

## Workflow

### Step 1: Generate Schema Once (LLM Call)

```python
# ONE-TIME LLM COST (~$0.001)
schema = JsonCssExtractionStrategy.generate_schema(
    html=sample_html,
    schema_type="CSS",
    query="Extract product information including name, price, description"
)

# Save schema for reuse
with open("product_schema.json", "w") as f:
    json.dump(schema, f, indent=2)
```

### Step 2: Use Schema for Extraction (No LLM Calls)

```python
# Load cached schema - FREE
with open("product_schema.json", "r") as f:
    schema = json.load(f)

# Create extraction strategy
strategy = JsonCssExtractionStrategy(schema, verbose=True)

# Extract data from multiple pages - ALL FREE
async with AsyncWebCrawler() as crawler:
    result = await crawler.arun(
        url="https://example.com/products",
        config=CrawlerRunConfig(extraction_strategy=strategy)
    )
    data = json.loads(result.extracted_content)
```

---

## Complete Example

### Generate and Cache Schema

```python
import json
import asyncio
from pathlib import Path
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, LLMConfig
from crawl4ai import JsonCssExtractionStrategy

async def smart_extraction_workflow():
    # Check for cached schema
    cache_dir = Path("./schema_cache")
    cache_dir.mkdir(exist_ok=True)
    schema_file = cache_dir / "product_schema.json"
    
    if schema_file.exists():
        # Load cached schema - NO LLM CALLS
        schema = json.load(schema_file.open())
        print("✅ Using cached schema (FREE)")
    else:
        # Generate schema ONCE
        print("↺ Generating schema (ONE-TIME LLM COST)...")
        
        llm_config = LLMConfig(
            provider="openai/gpt-4o-mini",
            api_token="env:OPENAI_API_KEY"
        )
        
        # Get sample HTML
        async with AsyncWebCrawler() as crawler:
            sample_result = await crawler.arun(
                url="https://example.com/products"
            )
            sample_html = sample_result.cleaned_html[:8000]
        
        # AUTO-GENERATE SCHEMA
        schema = JsonCssExtractionStrategy.generate_schema(
            html=sample_html,
            schema_type="CSS",
            query="Extract product information including name, price, description, features",
            llm_config=llm_config
        )
        
        # Cache for unlimited future use
        json.dump(schema, schema_file.open("w"), indent=2)
        print("✅ Schema generated and cached")
    
    # Use schema for extraction
    strategy = JsonCssExtractionStrategy(schema, verbose=True)
    
    config = CrawlerRunConfig(extraction_strategy=strategy)
    
    # Extract from multiple pages - ALL FREE
    urls = [
        "https://example.com/products",
        "https://example.com/electronics", 
        "https://example.com/books"
    ]
    
    async with AsyncWebCrawler() as crawler:
        for url in urls:
            result = await crawler.arun(url=url, config=config)
            if result.success:
                data = json.loads(result.extracted_content)
                print(f"✅ {url}: Extracted {len(data)} items (FREE)")

asyncio.run(smart_extraction_workflow())
```

---

## Schema Format Details

### Basic Schema

```json
{
  "name": "Crypto Prices",
  "baseSelector": "div.crypto-row",
  "fields": [
    {
      "name": "coin_name",
      "selector": "h2.coin-name",
      "type": "text"
    },
    {
      "name": "price",
      "selector": "span.coin-price",
      "type": "text"
    }
  ]
}
```

### Advanced Schema with All Field Types

```json
{
  "name": "Product Details",
  "baseSelector": "div.product-card",
  "fields": [
    {
      "name": "title",
      "selector": "h2.title",
      "type": "text"
    },
    {
      "name": "link_url",
      "selector": "a.product-link",
      "type": "attribute",
      "attribute": "href"
    },
    {
      "name": "description",
      "selector": "div.description",
      "type": "html"
    },
    {
      "name": "price_value",
      "selector": "span.price",
      "type": "regex",
      "pattern": "\\d+\\.\\d{2}"
    },
    {
      "name": "image",
      "selector": "img.product-image",
      "type": "attribute",
      "attribute": "src"
    }
  ]
}
```

---

## Key Differences from Our Implementation

### Crawl4AI Approach

1. **Schema Format**: Uses `baseSelector` + `fields` array
2. **Field Types**: Supports text, attribute, html, regex
3. **LLM Integration**: Uses `LLMConfig` object
4. **Caching**: Explicit file-based caching recommended
5. **Extraction**: Returns JSON array of extracted items

### Our Current Implementation

1. **Schema Format**: Similar but adds `pagination` field
2. **Field Types**: Supports text, attribute, number (with transform)
3. **LLM Integration**: Direct OpenAI client
4. **Caching**: In-memory Map cache
5. **Extraction**: Returns array via page.evaluate()

---

## Improvements to Make

### 1. Match Crawl4AI Schema Format

```javascript
// Current format
{
  "baseSelector": "tr.athing",
  "fields": [
    {"name": "title", "selector": "...", "type": "text", "transform": "trim"}
  ],
  "pagination": {"type": "query", "pattern": "?p={page}"}
}

// Should add
{
  "name": "Hacker News Posts",  // Add schema name
  "baseSelector": "tr.athing",
  "fields": [
    {
      "name": "title",
      "selector": "...",
      "type": "text",
      "default": "",  // Add default value support
      "transform": "trim"
    }
  ],
  "pagination": {"type": "query", "pattern": "?p={page}"}
}
```

### 2. Add More Field Types

Support Crawl4AI's field types:
- `html`: Extract HTML block
- `regex`: Extract using regex pattern

### 3. File-Based Schema Caching

```javascript
import fs from 'fs';
import path from 'path';

const SCHEMA_CACHE_DIR = './schema_cache';

function getCachedSchema(domain) {
  const schemaFile = path.join(SCHEMA_CACHE_DIR, `${domain}.json`);
  if (fs.existsSync(schemaFile)) {
    return JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
  }
  return null;
}

function saveSchema(domain, schema) {
  if (!fs.existsSync(SCHEMA_CACHE_DIR)) {
    fs.mkdirSync(SCHEMA_CACHE_DIR, { recursive: true });
  }
  const schemaFile = path.join(SCHEMA_CACHE_DIR, `${domain}.json`);
  fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2));
}
```

### 4. Improve LLM Prompt

Match Crawl4AI's approach more closely:

```javascript
const prompt = `You are an expert web scraping assistant. Analyze the HTML and generate a CSS extraction schema.

HTML CONTENT:
${html.substring(0, 5000)}

USER QUERY: ${query}

Generate a JSON schema with this EXACT format:
{
  "name": "Descriptive schema name",
  "baseSelector": "CSS selector for repeating container",
  "fields": [
    {
      "name": "field_name",
      "selector": "CSS selector relative to baseSelector",
      "type": "text|attribute|html|regex",
      "attribute": "attribute_name (only for type=attribute)",
      "pattern": "regex_pattern (only for type=regex)",
      "default": "default_value (optional)"
    }
  ]
}

IMPORTANT:
- baseSelector should target the repeating container element
- All field selectors are relative to baseSelector
- Use simple, robust CSS selectors
- Prefer class names over complex combinators
- type must be one of: text, attribute, html, regex

Output ONLY the JSON schema, no explanation.`;
```

---

## Cost Analysis

### Crawl4AI Approach

- **First scrape**: 1 LLM call (~$0.001 with gpt-4o-mini)
- **Schema caching**: Save to file
- **Future scrapes**: 0 LLM calls ($0)
- **Scalability**: Unlimited extractions with cached schema

### Example Cost Breakdown

```
Scenario: Scrape 10,000 product pages

Traditional LLM extraction:
- 10,000 LLM calls × $0.001 = $10.00

Crawl4AI schema approach:
- 1 LLM call (schema generation) = $0.001
- 10,000 extractions (cached schema) = $0.00
- Total = $0.001

Savings: $9.999 (99.99% cost reduction)
```

---

## Best Practices from Crawl4AI

### 1. Always Cache Schemas

```python
# Check cache first
if schema_file.exists():
    schema = json.load(schema_file.open())
else:
    schema = JsonCssExtractionStrategy.generate_schema(...)
    json.dump(schema, schema_file.open("w"))
```

### 2. Use Sample HTML

Don't send entire page to LLM:

```python
sample_html = result.cleaned_html[:8000]  # First 8KB is enough
```

### 3. Use Cheapest LLM

```python
llm_config = LLMConfig(
    provider="openai/gpt-4o-mini",  # Cheapest option
    api_token="env:OPENAI_API_KEY"
)
```

### 4. Verbose Mode for Debugging

```python
strategy = JsonCssExtractionStrategy(schema, verbose=True)
```

### 5. Schema Versioning

```json
{
  "name": "Product Schema v1.0",
  "version": "1.0",
  "created": "2026-04-02",
  "baseSelector": "...",
  "fields": [...]
}
```

---

## Summary

### Crawl4AI's Approach

1. **Generate schema once** with LLM (~$0.001)
2. **Cache schema** to file
3. **Reuse schema** for unlimited extractions ($0)
4. **Result**: 99.99% cost reduction for large-scale scraping

### Key Takeaways

- Schema format: `{name, baseSelector, fields[]}`
- Field types: text, attribute, html, regex
- Caching is critical for cost savings
- Use sample HTML (not full page) for schema generation
- One schema per domain/site structure

---

## References

- [Crawl4AI Documentation](https://github.com/unclecode/crawl4ai)
- [JsonCssExtractionStrategy](https://github.com/unclecode/crawl4ai/blob/main/docs/md_v2/extraction/no-llm-strategies.md)
- [Schema Generation Release Notes](https://github.com/unclecode/crawl4ai/blob/main/docs/md_v2/blog/releases/v0.4.3b1.md)

---

**Research completed**: April 2, 2026  
**Source**: Context7 documentation search  
**Library**: /unclecode/crawl4ai
