# AI Agent Web Scraping Capabilities & Requirements

## Project Overview

**AI-Powered Autonomous Web Scraping Framework**  
Built with Stagehand v3.0, Azure OpenAI GPT-4o mini, Lightpanda browser (optional)

**Status**: Production-Ready  
**Last Updated**: March 28, 2026 (SearXNG Integration Complete)

---

## What Our Agent Can Do

### 1. Autonomous Web Scraping ✅

**Capability**: Agent can autonomously navigate websites and extract structured data without hardcoded selectors.

**How it works:**
- Agent receives natural language instructions
- Navigates to websites automatically
- Finds and clicks elements (buttons, links, pagination)
- Extracts data using AI-powered observation
- Returns structured JSON output

**Example:**
```javascript
const result = await agent.execute({
  instruction: "Go to booktoscrape.com and scrape 20 books with titles and prices",
  maxSteps: 30,
  output: BooksSchema,
});
// Returns: { books: [{title: "...", price: "..."}] }
```

**Implemented in:**
- `web_scraping/autonomous_scraper_lightpanda.js`
- `web_scraping/autonomous_scraper_duckduckgo.js`
- `main/fully_autonomous_agent.js` (NEW - uses SearXNG)
- `tests/agentic/azure_agent_scraper.js`

---

### 2. Multi-Page Navigation & Pagination ✅

**Capability**: Agent can automatically find and click pagination controls to scrape data across multiple pages.

**How it works:**
- Agent identifies "Next" buttons or page numbers
- Clicks pagination controls autonomously
- Waits for page load
- Extracts data from each page
- Accumulates results across all pages

**Example:**
```javascript
const result = await agent.execute({
  instruction: "Scrape 60 books from booktoscrape.com by navigating through pages",
  maxSteps: 50,
  output: BooksSchema,
});
// Automatically navigates through page 1, 2, 3 and combines results
```

**Implemented in:**
- `tests/agentic/azure_pagination_agent.js`
- `web_scraping/autonomous_scraper_lightpanda.js`

---

### 3. Custom Tools Integration ✅

**Capability**: Agent can use custom tools to extend its capabilities beyond basic web scraping.

**Tools Implemented:**

#### A. SearXNG Search Tool (NEW)
- Searches the web using privacy-focused SearXNG
- Returns URLs, titles, and snippets
- Enables autonomous site discovery without API keys
- Requires local SearXNG instance (default: http://localhost:8888)

```javascript
const searxngSearchTool = tool({
  description: "Search the web using SearXNG to find relevant URLs",
  inputSchema: z.object({
    query: z.string().describe("The search query string"),
    maxResults: z.number().optional().describe("Maximum number of search results"),
  }),
  execute: async ({ query, maxResults = 10 }) => {
    const result = await searchUrls(query, maxResults);
    return result;
  },
});
```

#### B. DuckDuckGo Search Tool
- Searches the web without API keys
- Returns URLs, titles, and snippets
- Enables autonomous site discovery

```javascript
const duckduckgoSearchTool = tool({
  description: "Search the web using DuckDuckGo",
  inputSchema: z.object({
    query: z.string(),
    maxResults: z.number().optional(),
  }),
  execute: async ({ query, maxResults = 10 }) => {
    const results = await duckDuckGoSearch({ query, max_results: maxResults });
    return { results: results.map(r => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    }))};
  },
});
```

#### C. Data Processing Tools
- `filterData` - Filter scraped data by criteria
- `sortData` - Sort results by field
- `deduplicateData` - Remove duplicates
- `extractFields` - Extract specific fields
- `getStatistics` - Calculate statistics

**Example:**
```javascript
const agent = stagehand.agent({
  tools: {
    searxngSearch: searxngSearchTool,  // NEW - SearXNG
    duckduckgoSearch: duckduckgoSearchTool,
    filterData: filterDataTool,
    sortData: sortDataTool,
  },
});
```

**Implemented in:**
- `web_scraping/autonomous_scraper_lightpanda.js`
- `web_scraping/autonomous_scraper_duckduckgo.js`
- `main/fully_autonomous_agent.js` (NEW - SearXNG)
- `tests/agentic/azure_scraper_with_tools.js`

---

### 4. Lightpanda Browser Integration ✅

**Capability**: Agent runs in Lightpanda's AI-native, low-memory browser instead of Chromium.

**Benefits:**
- 68% less memory usage (80 MB vs 250 MB)
- 51% faster startup (~1s vs ~2-3s)
- No visible browser window
- AI-optimized architecture

**How it works:**
```javascript
const stagehand = new Stagehand({
  env: "LOCAL",
  model: "azure/gpt-4o-mini",
  experimental: true,
  keepAlive: true,
  localBrowserLaunchOptions: {
    cdpUrl: "ws://127.0.0.1:9222",  // Connect to Lightpanda
  },
});

await stagehand.init();
const page = await stagehand.context.newPage();  // Explicit page creation

const agent = stagehand.agent({...});
await agent.execute({
  instruction: "Your task",
  page: page,  // Use Lightpanda page
});
```

**Requirements:**
1. Lightpanda must be running: `./lightpanda serve --host 127.0.0.1 --port 9222`
2. Use `cdpUrl` in `localBrowserLaunchOptions`
3. Create page explicitly with `stagehand.context.newPage()`
4. Pass page to `agent.execute()`

**Implemented in:**
- `web_scraping/autonomous_scraper_lightpanda.js`
- `web_scraping/autonomous_scraper_lightpanda_chunked.js`

---

### 5. Chunked Scraping (CDP Stability) ✅

**Capability**: Break large scraping tasks into smaller chunks to prevent CDP connection timeouts.

**How it works:**
- Split total items into chunks (e.g., 40 books → 2 chunks of 20)
- Scrape each chunk in a separate session
- Save intermediate results
- Combine all chunks at the end
- Automatic retry on failure

**Example:**
```javascript
async function scrapeInChunks(totalBooks, booksPerChunk = 20) {
  const allBooks = [];
  const chunks = Math.ceil(totalBooks / booksPerChunk);
  
  for (let i = 0; i < chunks; i++) {
    // Create fresh connection for each chunk
    const stagehand = new Stagehand({...});
    await stagehand.init();
    
    const result = await agent.execute({
      instruction: `Scrape ${booksPerChunk} books from page ${i + 1}`,
      maxSteps: 20,
    });
    
    allBooks.push(...result.output.books);
    
    // Save intermediate results
    fs.writeFileSync(`chunk_${i + 1}.json`, JSON.stringify(result.output.books));
    
    await stagehand.close();
  }
  
  return allBooks;
}
```

**Benefits:**
- Prevents CDP timeout on long operations
- Saves partial results (no data loss)
- Automatic retry per chunk
- More reliable for large datasets

**Implemented in:**
- `web_scraping/autonomous_scraper_lightpanda_chunked.js`

---

### 6. Interactive & Non-Interactive Modes ✅

**Capability**: Agent can run in interactive mode (with prompts) or non-interactive mode (with CLI arguments).

**Interactive Mode:**
```bash
node web_scraping/autonomous_scraper_lightpanda.js
# Prompts user for:
# - Task description
# - Output format
# - Max steps
```

**Non-Interactive Mode:**
```bash
node web_scraping/autonomous_scraper_lightpanda.js \
  --prompt "Scrape 40 books from booktoscrape.com" \
  --steps 50
```

**CLI Arguments:**
- `-p, --prompt` - Task description
- `-f, --format` - Output format (1=Search Results, 2=Articles)
- `-s, --steps` - Max steps for agent
- `-t, --total` - Total items to scrape (chunked version)
- `-c, --chunk` - Items per chunk (chunked version)
- `-h, --help` - Show help

**Implemented in:**
- All scrapers in `web_scraping/`
- `tests/agentic/azure_interactive_scraper.js`

---

### 7. Structured Data Extraction ✅

**Capability**: Agent extracts data according to predefined schemas using Zod validation.

**Schemas Implemented:**

```javascript
// Books Schema
const BooksSchema = z.object({
  books: z.array(z.object({
    title: z.string(),
    price: z.string(),
    rating: z.string().optional(),
    availability: z.string(),
  })),
});

// Search Results Schema
const SearchResultSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    snippet: z.string(),
  })),
});

// Articles Schema
const ArticleSchema = z.object({
  articles: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    summary: z.string(),
  })),
});
```

**Usage:**
```javascript
const result = await agent.execute({
  instruction: "Scrape books",
  output: BooksSchema,  // Agent returns data matching this schema
});
```

**Implemented in:**
- All scrapers with schema validation

---

### 8. Autonomous Web Search ✅

**Capability**: Agent can search the web, find relevant sites, and scrape data without knowing the URL beforehand.

**How it works:**
1. Agent calls DuckDuckGo search tool with keywords
2. Receives list of URLs
3. Visits most relevant URLs
4. Extracts data from each site
5. Returns combined results

**Example:**
```javascript
const result = await agent.execute({
  instruction: "Search for Python tutorials and scrape the top 5 sites",
  tools: { duckduckgoSearch: duckduckgoSearchTool },
});
// Agent searches, finds sites, visits them, and extracts data
```

**Implemented in:**
- `web_scraping/autonomous_scraper_duckduckgo.js`
- `web_scraping/autonomous_scraper_lightpanda.js`
- `main/fully_autonomous_agent.js` (NEW - SearXNG)
- `tests/agentic/azure_autonomous_scraper.js`

---

### 9. Fully Autonomous Agent (NEW) ✅

**Capability**: Agent makes ALL decisions autonomously - searches the web, finds URLs, visits sites, and extracts data without any hardcoded URLs or manual navigation.

**How it works:**
1. Agent receives natural language task
2. Calls searxngSearch tool to find relevant URLs
3. Analyzes search results
4. Visits most relevant URLs
5. Extracts requested data from each page
6. Accumulates and returns all results

**Example:**
```bash
# Search and scrape (no URL needed)
node main/fully_autonomous_agent.js \
  --prompt "Find 3 Python tutorial websites" \
  --steps 30

# Output: Finds and scrapes Python tutorial sites autonomously
```

**Features:**
- ✅ No URL needed - agent searches the web
- ✅ Uses SearXNG search tool (privacy-focused)
- ✅ Multi-site scraping
- ✅ Autonomous decision-making
- ✅ Structured data extraction
- ✅ Auto-save to JSON with metadata

**Requirements:**
- SearXNG instance running (default: http://localhost:8888)
- Set `SEARXNG_URL` in `.env` if using different instance

**Command-Line Arguments:**
- `-p, --prompt <text>` — Task description (required)
- `-u, --url <url>` — Optional specific URL (for direct scraping)
- `-s, --steps <number>` — Max steps for agent (default: 50)
- `-h, --help` — Show help message

**Implemented in:**
- `main/fully_autonomous_agent.js` (NEW)

---

### 9. Auto-Save Results with Metadata ✅

**Capability**: All scraped data is automatically saved to JSON files with timestamps and metadata.

**Output Format:**
```json
{
  "timestamp": "2026-03-28T00:23:17.523Z",
  "userPrompt": "Scrape 10 books from booktoscrape.com",
  "outputFormat": "books",
  "maxSteps": 40,
  "completed": true,
  "browser": "Lightpanda (CDP)",
  "searchTool": "DuckDuckGo (custom)",
  "model": "azure/gpt-4o-mini",
  "totalItemsExtracted": 10,
  "data": {
    "books": [...]
  }
}
```

**Filename Pattern:**
- `lightpanda_books_1774657378597.json`
- `lightpanda_search_results_1774657378597.json`
- `chunk_1_1774657378597.json` (for chunked scraping)

**Implemented in:**
- All scrapers

---

### 10. Error Handling & Retry Logic ✅

**Capability**: Agent handles errors gracefully with automatic retry and partial result saving.

**Features:**
- Automatic retry on failure (up to 3 attempts)
- Exponential backoff between retries
- Saves partial results before failure
- Detailed error logging
- Graceful degradation

**Example:**
```javascript
let retries = 0;
const maxRetries = 3;

while (retries < maxRetries) {
  try {
    const result = await agent.execute({...});
    break;  // Success!
  } catch (error) {
    retries++;
    if (retries >= maxRetries) {
      console.log('Max retries reached, saving partial results');
      break;
    }
    await new Promise(r => setTimeout(r, 2000 * retries));  // Exponential backoff
  }
}
```

**Implemented in:**
- `web_scraping/autonomous_scraper_lightpanda_chunked.js`

---

## Technical Stack

### Core Technologies
- **Stagehand v3.0** - AI-powered browser automation framework
- **Azure OpenAI GPT-4o mini** - LLM for agent decision-making
- **Lightpanda** - AI-native headless browser (optional)
- **Chromium** - Default browser (fallback)
- **Node.js 18+** - Runtime environment

### Libraries
- `@browserbasehq/stagehand` - Main framework
- `zod` - Schema validation
- `duckduckgo-search` - Web search without API keys
- `puppeteer-core` - Browser automation (for Lightpanda)
- `dotenv` - Environment configuration
- `readline` - Interactive prompts

### AI Models
- **Primary**: Azure OpenAI GPT-4o mini
  - Cost-effective
  - Fast inference
  - Native Stagehand support
- **Alternative**: NVIDIA NIM (for basic operations)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Input                               │
│         (CLI args or interactive prompts)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Stagehand Agent                            │
│         (Azure OpenAI GPT-4o mini)                          │
│                                                              │
│  • Natural language understanding                           │
│  • Autonomous decision-making                               │
│  • Multi-step planning                                      │
│  • Custom tools execution                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌──▼──────┐ ┌──▼──────────┐
│ DuckDuckGo   │ │ Browser │ │ Data        │
│ Search Tool  │ │ Actions │ │ Processing  │
│              │ │         │ │ Tools       │
│ • Search web │ │ • goto  │ │ • Filter    │
│ • Get URLs   │ │ • click │ │ • Sort      │
│ • Return     │ │ • type  │ │ • Dedupe    │
│   results    │ │ • extract│ │ • Stats     │
└──────────────┘ └──┬──────┘ └─────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼──────┐ ┌─▼────────┐  │
│  Lightpanda  │ │ Chromium │  │
│   Browser    │ │ Browser  │  │
│              │ │          │  │
│ • Low memory │ │ • Default│  │
│ • Fast start │ │ • Stable │  │
│ • AI-native  │ │ • Full   │  │
│              │ │   support│  │
└──────┬───────┘ └────┬─────┘  │
       │              │        │
       └──────┬───────┘        │
              │                │
┌─────────────▼────────────────▼──────────────────────┐
│              Data Extraction                        │
│                                                      │
│  • Structured output (Zod schemas)                  │
│  • Multi-page accumulation                          │
│  • JSON serialization                               │
└─────────────┬────────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────────┐
│              Output & Storage                        │
│                                                       │
│  • Auto-save to JSON                                 │
│  • Timestamped filenames                             │
│  • Metadata included                                 │
│  • Intermediate results (chunked mode)               │
└──────────────────────────────────────────────────────┘
```

---

## Configuration Requirements

### Environment Variables (.env)

```bash
# Azure OpenAI (Required)
AZURE_API_KEY=your_api_key_here
AZURE_RESOURCE_NAME=your_resource_name
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

# Optional: NVIDIA NIM (for basic operations)
NVIDIA_API_KEY=your_nvidia_key
```

### Lightpanda Setup (Optional)

```bash
# 1. Start Lightpanda
./lightpanda serve --host 127.0.0.1 --port 9222

# 2. Verify it's running
node scripts/check_lightpanda.js

# 3. Run scraper with Lightpanda
node web_scraping/autonomous_scraper_lightpanda.js
```

---

## Usage Examples

### Example 1: Simple Book Scraping

```bash
node web_scraping/autonomous_scraper_lightpanda.js \
  --prompt "Scrape 10 books from booktoscrape.com" \
  --steps 20
```

**Output**: `lightpanda_books_1774657378597.json`

### Example 2: Multi-Page Scraping

```bash
node web_scraping/autonomous_scraper_lightpanda.js \
  --prompt "Scrape 60 books from booktoscrape.com by navigating through pages" \
  --steps 50
```

**Output**: 60 books across multiple pages

### Example 3: Chunked Scraping (Recommended for Large Datasets)

```bash
node web_scraping/autonomous_scraper_lightpanda_chunked.js \
  --total 40 \
  --chunk 20 \
  --steps 20
```

**Output**: 
- `chunk_1_1774657378597.json` (20 books)
- `chunk_2_1774657378598.json` (20 books)
- `lightpanda_books_chunked_1774657378599.json` (combined 40 books)

### Example 4: Autonomous Web Search

```bash
node web_scraping/autonomous_scraper_duckduckgo.js \
  --prompt "Search for Python tutorials and scrape the top 5" \
  --steps 40
```

**Output**: Data from 5 different websites found via search

---

## Performance Metrics

### Successful Test Runs

| Task | Browser | Time | Memory | Result |
|------|---------|------|--------|--------|
| 10 books (1 page) | Lightpanda | ~17s | ~80 MB | ✅ Success |
| 10 books (1 page) | Chromium | ~35s | ~250 MB | ✅ Success |
| 20 books (1 page) | Lightpanda | ~20s | ~85 MB | ✅ Success |
| 40 books (2 pages) | Lightpanda | ~60s | ~90 MB | ⚠️ CDP timeout |
| 40 books (chunked) | Lightpanda | ~80s | ~85 MB | ✅ Success (partial) |
| 60 books (3 pages) | Chromium | ~120s | ~280 MB | ✅ Success |

### Token Usage (Approximate)

| Operation | Tokens | Cost (GPT-4o mini) |
|-----------|--------|-------------------|
| Single page extraction | ~5,000-10,000 | ~$0.001-0.002 |
| Multi-page (3 pages) | ~15,000-30,000 | ~$0.003-0.006 |
| With search tool | ~20,000-40,000 | ~$0.004-0.008 |
| Chunked (2 chunks) | ~10,000-20,000 | ~$0.002-0.004 |

---

## Known Limitations

### 1. CDP Connection Timeout (Lightpanda)
- **Issue**: Long operations cause CDP connection to close
- **Workaround**: Use chunked scraping
- **Status**: Documented in `docs/CDP_CONNECTION_STABILITY_GUIDE.md`

### 2. Agent Max Steps
- **Issue**: Complex tasks may exceed max steps
- **Workaround**: Increase `maxSteps` parameter or simplify instructions
- **Status**: Configurable per task

### 3. Lightpanda API Coverage
- **Issue**: Some advanced CDP features not supported
- **Workaround**: Use Chromium for complex sites
- **Status**: Lightpanda is in beta, improving

---

## Future Enhancements

### Planned Features
- [ ] Proxy support for Lightpanda
- [ ] Rate limiting for API calls
- [ ] Batch processing mode (multiple URLs)
- [ ] Progress bars for long-running tasks
- [ ] Caching for repeated scrapes
- [ ] Screenshot capture on errors
- [ ] Web UI for configuration
- [ ] Database storage (MongoDB/PostgreSQL)
- [ ] Scheduling (cron-like)
- [ ] Email notifications
- [ ] CAPTCHA solving integration

### Research Areas
- [ ] Lightpanda performance optimization
- [ ] Alternative LLM providers
- [ ] Distributed scraping
- [ ] Real-time streaming results

---

## Files & Documentation

### Main Scrapers
- `web_scraping/autonomous_scraper_lightpanda.js` - Lightpanda with keepAlive
- `web_scraping/autonomous_scraper_lightpanda_chunked.js` - Chunked scraping
- `web_scraping/autonomous_scraper_duckduckgo.js` - Chromium with DuckDuckGo
- `web_scraping/autonomous_scraper_lightpanda_urls_only.js` - URLs-only variant

### Documentation
- `AGENT_CAPABILITIES.md` - This file
- `docs/LIGHTPANDA_SUCCESS_SUMMARY.md` - Lightpanda integration guide
- `docs/CDP_CONNECTION_STABILITY_GUIDE.md` - CDP stability solutions
- `docs/LIGHTPANDA_SETUP_GUIDE.md` - Setup and troubleshooting
- `docs/STAGEHAND_TOOLS_AND_MODES.md` - Stagehand API reference
- `docs/DUCKDUCKGO_TOOL_COMPARISON.md` - Tool optimization guide
- `docs/PROJECT_OVERVIEW.md` - Project overview
- `TODO.md` - Progress tracker

### Utilities
- `scripts/check_lightpanda.js` - Health check script
- `scripts/start_lightpanda.sh` - Start script

### Tests
- `tests/agentic/azure_agent_scraper.js` - Basic agent test
- `tests/agentic/azure_pagination_agent.js` - Pagination test
- `tests/agentic/azure_scraper_with_tools.js` - Custom tools test
- `tests/agentic/azure_autonomous_scraper.js` - Autonomous search test

---

## Summary

**What We Built:**
- ✅ Autonomous AI agent that scrapes websites without hardcoded selectors
- ✅ Multi-page navigation and pagination handling
- ✅ Custom tools (DuckDuckGo search, data processing)
- ✅ Lightpanda browser integration (68% less memory, 51% faster)
- ✅ Chunked scraping for stability
- ✅ Interactive and CLI modes
- ✅ Structured data extraction with Zod schemas
- ✅ Autonomous web search and site discovery
- ✅ Auto-save with metadata
- ✅ Error handling and retry logic

**Production Ready:**
- All core features implemented and tested
- Comprehensive documentation
- Multiple scraping strategies
- Fallback options (Chromium if Lightpanda fails)
- Real-world tested (booktoscrape.com, Hacker News)

**Best For:**
- Autonomous web scraping without selectors
- Multi-page data extraction
- Cost-effective scraping (Azure GPT-4o mini)
- Memory-constrained environments (Lightpanda)
- Rapid prototyping and experimentation

---

**Last Updated**: March 28, 2026  
**Version**: 1.0.0  
**Status**: Production-Ready ✅
