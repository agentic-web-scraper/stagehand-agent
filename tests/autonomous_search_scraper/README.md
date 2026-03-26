# 🤖 Autonomous Web Scraper with Brave Search

Interactive autonomous web scraper powered by Stagehand v3.0 and built-in Brave Search. No pre-defined URLs needed—just describe what you want, and let the agent search and extract it for you.

## Features

✨ **Autonomous Search** — Agent uses Brave Search (built-in) to find relevant URLs
🎯 **Natural Language Prompts** — Describe your task in plain English
📊 **Flexible Output Formats** — Search results, articles, or structured web data
🔄 **Real-Time Streaming** — See agent progress as it executes
💾 **Auto-Save Results** — Results saved as JSON files with timestamps
🛠️ **No Setup Required** — Uses Azure OpenAI from `.env`

## Architecture

```
User Prompt (Interactive Input)
            ↓
  Autonomous Agent (Stagehand)
            ↓
  Brave Search Tool (Built-in)
     ↓          ↓
  Search URLs   Extract
     ↓          ↓
  Navigate Pages
     ↓
  Structured Data Extraction (Zod Schemas)
     ↓
  Output (JSON) + Console Display
```

## Quick Start

### 1. Ensure Environment is Configured

Make sure `.env` has Azure OpenAI credentials:

```env
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
```

### 2. Run the Autonomous Scraper

```bash
node tests/autonomous_search_scraper/autonomous_scraper.js
```

### 3. Follow Interactive Prompts

```
🎯 What would you like to search and scrape?
   > Search for latest AI frameworks and extract their documentation URLs

📊 Choose output format:
   1. Search Results (default)
   2. Articles/Blog Posts
   3. General Web Page Data

⏱️  Max steps for agent (default 30):
   > 40
```

## Example Tasks

| Task | Expected Output |
|------|-----------------|
| "Search for top Node.js frameworks and get their GitHub URLs" | Search Results with URLs |
| "Find latest machine learning research papers and summarize them" | Articles with summaries |
| "Search for web scraping tools and extract their features/pricing" | Web Page Data |
| "Find JavaScript web automation libraries and extract setup instructions" | Search Results + Data |

## Output Formats

### 1. Search Results (Default)

```json
{
  "timestamp": "2026-03-26T10:30:00.000Z",
  "userPrompt": "Search for AI frameworks",
  "data": {
    "results": [
      {
        "title": "TensorFlow",
        "url": "https://tensorflow.org",
        "snippet": "Open-source ML platform..."
      }
    ]
  }
}
```

### 2. Articles

```json
{
  "data": {
    "articles": [
      {
        "title": "Getting Started with RAG",
        "url": "https://example.com/rag-guide",
        "summary": "An introduction to Retrieval-Augmented Generation...",
        "author": "Jane Doe"
      }
    ]
  }
}
```

### 3. Web Page Data

```json
{
  "data": {
    "title": "TensorFlow Overview",
    "description": "TensorFlow is an end-to-end open source...",
    "data": [
      { "name": "Features", "value": "Multi-platform, GPU support..." },
      { "name": "License", "value": "Apache 2.0" }
    ]
  }
}
```

## How It Works

### Agent Capabilities

1. **Search (`useSearch: true`)** — Brave Search queries web
2. **Navigate** — Visits URLs returned by search
3. **Extract** — Pulls structured data with Zod schemas  
4. **Validate** — Ensures quality of extracted data
5. **Synthesize** — Combines data from multiple sources

### Stagehand Primitives Used

```typescript
// Under the hood:
await agent.execute({
  instruction: userPrompt,      // Natural language task
  useSearch: true,              // Enable Brave Search
  maxSteps: 30,                 // Agent step limit
  output: selectedSchema,       // Zod schema for structure
});
```

### Context7 Documentation

Based on official Stagehand documentation:
- **Web Search:** `/docs/v3/basics/agent.mdx` — `useSearch: true` enables Brave Search
- **Autonomous Agents:** `/docs/v3/basics/agent.mdx` — Multi-step workflow execution
- **Structured Output:** `/docs/v3/basics/agent.mdx` — Zod schema validation

## Customization

### Add Your Own Schema

Modify `autonomous_scraper.js` to add custom extraction formats:

```javascript
const CustomSchema = z.object({
  items: z.array(z.object({
    // Your fields here
  }))
});
```

### Adjust Agent Behavior

Edit the `systemPrompt` to guide agent behavior:

```javascript
const agent = stagehand.agent({
  systemPrompt: `
    Custom instructions for the agent...
    Focus on: X, Y, Z
    Avoid: A, B, C
  `
});
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `AZURE_OPENAI_API_KEY` | Yes | Azure OpenAI authentication |
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint URL |

## File Outputs

Results are automatically saved to:
- `search_results_[timestamp].json` — For search results format
- `articles_[timestamp].json` — For articles format
- `webpage_data_[timestamp].json` — For web page data format

All files are saved in the current working directory.

## Troubleshooting

**Issue:** "Cannot connect to Azure OpenAI"
- **Solution:** Verify `.env` has correct `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT`

**Issue:** "Search not finding relevant results"
- **Solution:** Refine your prompt with more specific keywords or search terms

**Issue:** "Extraction incomplete"
- **Solution:** Increase `maxSteps` parameter (default 30, try 40-50)

**Issue:** "Schema validation fails"
- **Solution:** The extracted data doesn't match the Zod schema; try a different output format

## Advanced Usage

### Streaming Output

Modify to enable streaming (from Context7 docs):

```typescript
const agent = stagehand.agent({
  stream: true, // Enable streaming mode
});

const streamResult = await agent.execute({...});
for await (const delta of streamResult.textStream) {
  process.stdout.write(delta);
}
```

### Custom Tools

Add tools to agent (pattern from main project):

```typescript
const customTools = {
  filterResults: tool({
    description: "Filter search results by criteria",
    parameters: z.object({ ... }),
    execute: async ({ ... }) => { ... }
  })
};

await agent.execute({
  ...
  tools: customTools
});
```

## Performance Tips

| Optimization | Benefit |
|--------------|---------|
| Lower `maxSteps` (20-25) | Faster, cheaper execution |
| More specific prompts | Better search relevance |
| Simpler schemas | Faster extraction, fewer errors |
| Shorter `maxSteps` | Cost reduction with Azure OpenAI |

## Resources

- **Stagehand Docs:** https://docs.stagehand.dev
- **Brave Search:** Built-in, no API key needed
- **Azure OpenAI:** https://azure.microsoft.com/en-us/products/ai-services/openai-service/

---

**Created:** March 26, 2026  
**Framework:** Stagehand v3.0 + Brave Search (built-in)  
**Model:** Azure OpenAI GPT-4o mini
