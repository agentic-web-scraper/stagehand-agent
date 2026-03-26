# 🛠️ Autonomous Scraper with Custom DuckDuckGo Search Tool

This is an **improved version** that uses a **custom search tool** with DuckDuckGo instead of relying on paid Browserbase/Brave Search.

## Features

✨ **No API Key Needed** — DuckDuckGo is free, no authentication required
🔧 **Custom Tool** — Follows Stagehand's `tool()` pattern (same as other tools in the project)
🎯 **Autonomous Workflows** — Agent searches → navigates → extracts data
💾 **Auto-Save Results** — JSON output with timestamps
✅ **Works Now** — Uses only Azure OpenAI from your existing `.env`

## How It Works

```
Your Prompt
    ↓
Stagehand Agent
    ↓
Custom DuckDuckGo Search Tool
    ├─ Execute DuckDuckGo search API
    ├─ Return formatted results
    └─ Pass URLs to agent
    ↓
Agent Navigation & Extraction
    ├─ Visit top URLs
    ├─ Extract structured data
    ├─ Validate with Zod
    └─ Return results
    ↓
Output (JSON + Console)
```

## Quick Start

```bash
# Run the custom DuckDuckGo scraper
node tests/autonomous_search_scraper/autonomous_scraper_duckduckgo.js
```

### Interactive Prompts

```
🎯 What would you like to search and scrape?
   > Search for latest JavaScript frameworks and extract their GitHub URLs

📊 Choose output format:
   1. Search Results
   2. Articles with Summaries

⏱️ Max steps for agent: 25
```

## The Custom Tool Pattern

This uses Stagehand's **custom tool** API (same pattern as `azure_scraper_with_tools.js`):

```typescript
import { tool } from "@browserbasehq/stagehand";

const duckduckgoSearchTool = tool({
  description: "Search the web using DuckDuckGo search engine",
  parameters: z.object({
    query: z.string().describe("Search query"),
    maxResults: z.number().optional()
  }),
  execute: async ({ query, maxResults = 10 }) => {
    // Use duckduckgo-search library
    const results = await duckDuckGoSearch({
      query: query,
      max_results: maxResults,
    });
    // Return formatted results
    return {
      success: true,
      results: formatted
    };
  }
});

// Pass tool to agent
await agent.execute({
  instruction: userPrompt,
  tools: {
    duckduckgoSearch: duckduckgoSearchTool,
  }
});
```

## Architecture Comparison

### ❌ Built-in Search (requires BROWSERBASE_API_KEY)
```
useSearch: true
    ↓
Stagehand → Browserbase API → Brave Search
    ↓
(Paid, requires authentication)
```

### ✅ Custom Tool (DuckDuckGo)
```
tools: { duckduckgoSearch: tool(...) }
    ↓
Stagehand → Your Custom Tool → DuckDuckGo API
    ↓
(Free, no authentication)
```

## Custom Tool Implementation

The custom tool:
1. **Takes parameters** — Query and optional max results
2. **Validates inputs** — Zod schema enforcement
3. **Executes search** — Calls DuckDuckGo API
4. **Formats output** — Returns structured results with title/URL/snippet
5. **Handles errors** — Returns success flag and error message
6. **Agent accessible** — Agent can call it like any built-in tool

```typescript
// Agent can call this tool:
duckduckgoSearch({
  query: "JavaScript frameworks 2026",
  maxResults: 10
})
// Returns:
{
  success: true,
  results: [
    { title: "...", url: "...", snippet: "..." },
    { ... }
  ]
}
```

## Output Files

Automatically saved as JSON:
- `custom_search_results_[timestamp].json` — Format 1
- `custom_articles_[timestamp].json` — Format 2

Each includes:
- Timestamp and metadata
- Original prompt
- Search tool used (DuckDuckGo)
- Extracted data
- Model info (Azure OpenAI)

## Example: Search → Extract → Synthesize

**Prompt:** "Find latest AI frameworks and extract their GitHub URLs"

**What happens:**
1. Agent receives prompt
2. Agent calls `duckduckgoSearch("latest AI frameworks")`
3. Gets URLs: transformers.js, ollama, llamaindex, etc.
4. Agent navigates to each URL
5. Agent extracts: project name, GitHub link, description
6. Agent synthesizes results
7. Returns structured data

## Advantages vs Built-in Search

| Feature | DuckDuckGo Custom | Built-in (Brave) |
|---------|------------------|------------------|
| **Cost** | Free | Requires Browserbase |
| **API Key** | None needed | BROWSERBASE_API_KEY required |
| **Setup** | Already installed | Need paid account |
| **Reliability** | DuckDuckGo public API | Browserbase infrastructure |
| **Control** | Full customization | Limited |
| **Rate limits** | Reasonable | Higher (paid tier) |

## Customization Ideas

### 1. Limit Search Results
```typescript
maxResults: 5  // Get only top 5 results
```

### 2. Add Search Filters
```typescript
execute: async ({ query, language = "en", timerange = "m" }) => {
  // Add region/language/date filtering
}
```

### 3. Multiple Search Tools
```typescript
tools: {
  duckduckgoSearch: duckduckgoSearchTool,
  googleSearch: googleSearchTool,  // Add another
  githubSearch: githubSearchTool   // Add another
}
```

### 4. Search Result Ranking
```typescript
const ranked = results
  .sort((a, b) => calculateRelevance(b) - calculateRelevance(a))
  .slice(0, 10);
```

### 5. Add Caching
```typescript
const cache = new Map();
if (cache.has(query)) return cache.get(query);
const results = await duckDuckGoSearch({...});
cache.set(query, results);
return results;
```

## Dependencies

```json
{
  "@browserbasehq/stagehand": "^3.0.0",
  "duckduckgo-search": "^3.0.0",  // ← Custom search
  "zod": "^3.23.8",
  "dotenv": "^16.4.5"
}
```

## Environment Setup

Only need Azure OpenAI (already in your `.env`):

```env
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=your_endpoint
```

**No additional API keys required!**

## Workflow Steps Explained

### Step 1: Search Tool Execution
Agent determines search is needed → calls custom tool → DuckDuckGo API → returns results

### Step 2: URL Navigation
Agent receives top results → decides which URLs are relevant → navigates to them

### Step 3: Data Extraction
Agent `observe`s page → finds relevant data elements → `extract` with Zod schema

### Step 4: Synthesis
Agent combines data from multiple sources → validates against schema → returns final result

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "DuckDuckGo search failed" | DuckDuckGo API may be temporarily down, try again |
| "No results found" | Refine search query with better keywords |
| "Agent didn't call search tool" | Mention "search" in your prompt explicitly |
| "Schema validation fails" | Try simpler output format (Search Results vs Articles) |
| "Takes too long" | Reduce maxSteps (try 15-20) |

## Comparison: This vs Original

| Aspect | Original | Custom Tool |
|---|---|---|
| Search API | Browserbase (paid) | DuckDuckGo (free) |
| Setup | Need Browserbase account | `npm install` done |
| Cost | Paid tier | Free |
| Works now? | ❌ No (no API key) | ✅ Yes |
| Customization | Limited | Full control |
| Learning value | Basic agent usage | Tool creation pattern |

## Next Steps

1. **Run it:** `node autonomous_scraper_duckduckgo.js`
2. **Test with prompts:** Try searching for different topics
3. **Customize tool:** Add your own logic to DuckDuckGo tool
4. **Chain tools:** Create multiple custom tools
5. **Production deploy:** Add error handling, caching, logging

## Related Files

- `autonomous_scraper.js` — Basic version (needs Browserbase)
- `autonomous_scraper_advanced.js` — 10 modes version (needs Browserbase)
- `config.js` — Configuration presets
- `../azure_scraper_with_tools.js` — Similar tool pattern (in main project)

## Resources

- [Stagehand Custom Tools](https://docs.stagehand.dev/v3/basics/agent#tools)
- [DuckDuckGo Search](https://duckduckgo.com)
- [This Project's Tools Pattern](../azure_scraper_with_tools.js)

---

**Version:** 1.0 (with Custom Tools)  
**Date:** March 26, 2026  
**Search Tool:** DuckDuckGo (free, no API key)  
**Framework:** Stagehand v3.0 + Custom Tool API
