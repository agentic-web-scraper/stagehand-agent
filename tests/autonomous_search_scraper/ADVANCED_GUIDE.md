## 🚀 ADVANCED USAGE GUIDE

This guide covers the advanced autonomous scraper with multiple research modes.

## Running the Advanced Scraper

```bash
node tests/autonomous_search_scraper/autonomous_scraper_advanced.js
```

## Available Research Modes

### 1. **default** — General Purpose Web Scraping
- **Max Steps:** 30
- **Best for:** Quick searches, discovering general information
- **Example:** "Find information about TypeScript"

### 2. **research** — Academic & Research Papers
- **Max Steps:** 50
- **Best for:** Finding research papers, academic articles, studies
- **Example:** "Find recent AI safety research papers and extract authors and abstracts"
- **Output:** Academic sources with DOIs, affiliations, citations

### 3. **comparison** — Product & Tool Comparison
- **Max Steps:** 45
- **Best for:** Comparing tools, frameworks, products, pricing
- **Example:** "Compare web scraping tools and extract their features and pricing"
- **Output:** Features, pricing, pros/cons, integrations

### 4. **news** — News & Article Discovery
- **Max Steps:** 40
- **Best for:** Finding recent news, blog posts, articles
- **Example:** "Find latest Node.js framework releases and summarize them"
- **Output:** Titles, authors, dates, summaries, sources

### 5. **documentation** — Technical Documentation
- **Max Steps:** 50
- **Best for:** Finding guides, API docs, setup instructions
- **Example:** "Find Stagehand installation and basic usage documentation"
- **Output:** Setup steps, code examples, API endpoints, versions

### 6. **ecommerce** — Pricing & E-Commerce Research
- **Max Steps:** 45
- **Best for:** Product pricing, availability, specifications
- **Example:** "Find latest laptop prices and specs"
- **Output:** Prices, ratings, availability, specifications

### 7. **repos** — GitHub & Code Repository Discovery
- **Max Steps:** 50
- **Best for:** Finding GitHub projects, npm packages, libraries
- **Example:** "Find top Node.js CLI tools on GitHub"
- **Output:** URLs, stars, contributors, licenses, readmes

### 8. **jobs** — Job Market & Career Research
- **Max Steps:** 40
- **Best for:** Job postings, career trends, skills demand
- **Example:** "Find web scraping developer jobs and required skills"
- **Output:** Job titles, companies, skills, salaries, locations

### 9. **quick** — Quick Facts & Light Research
- **Max Steps:** 20
- **Best for:** Fact-checking, quick answers, basic lookups
- **Example:** "What is the latest Node.js LTS version?"
- **Output:** Quick facts, verified information

### 10. **deep** — Deep & Comprehensive Analysis
- **Max Steps:** 60
- **Best for:** Thorough research, comprehensive analysis
- **Example:** "Comprehensive analysis of web scraping technologies in 2026"
- **Output:** Detailed analysis from multiple sources

## Workflow

```
1. Start Script
   ↓
2. Select Research Mode (1-10)
   ↓
3. Enter Your Research Prompt
   ↓
4. Choose Output Format (1-4)
   • Search Results
   • Articles with Summaries
   • Structured Page Data
   • Generic Data Format
   ↓
5. Set Max Steps (Optional)
   ↓
6. Agent Executes with Brave Search
   • Searches relevant keywords
   • Navigates to URLs
   • Extracts structured data
   • Validates quality
   ↓
7. Results Displayed & Saved to JSON
```

## Example Sessions

### Session 1: Research Mode - AI Safety Papers

```
📋 Select mode: 2 (research)
🎯 What would you like to research?
   > Find recent AI safety research papers from 2025-2026

📊 Choose output format: 2 (articles)

⏱️ Max steps: 45
```

**Output:** `articles_[timestamp].json` with papers, authors, abstracts, publication info

---

### Session 2: Comparison Mode - Web Scraping Tools

```
📋 Select mode: 3 (comparison)
🎯 What would you like to research?
   > Compare web scraping frameworks: Stagehand, Playwright, Beautiful Soup, Selenium

📊 Choose output format: 3 (structured data)

⏱️ Max steps: 50
```

**Output:** `webpage_data_[timestamp].json` with features, pricing, pros/cons

---

### Session 3: Deep Research Mode - JavaScript Frameworks

```
📋 Select mode: 10 (deep)
🎯 What would you like to research?
   > Comprehensive analysis of modern JavaScript web frameworks in 2026

📊 Choose output format: 1 (search results)

⏱️ Max steps: 60
```

**Output:** `search_results_[timestamp].json` with detailed sources

---

### Session 4: Jobs Mode - Tech Career

```
📋 Select mode: 8 (jobs)
🎯 What would you like to research?
   > Web automation engineer positions and required skills

📊 Choose output format: 4 (generic data)

⏱️ Max steps: 40
```

**Output:** `generic_data_[timestamp].json` with jobs, companies, skills

---

## Output Format Selection

### 1. Search Results
Best for general queries, discovering URLs and snippets.
```json
{
  "results": [
    {
      "title": "...",
      "url": "...",
      "snippet": "..."
    }
  ]
}
```

### 2. Articles with Summaries
Best for news, blogs, research papers with author/date info.
```json
{
  "articles": [
    {
      "title": "...",
      "url": "...",
      "summary": "...",
      "author": "..."
    }
  ]
}
```

### 3. Structured Page Data
Best for extracting features, specs, key information.
```json
{
  "title": "...",
  "description": "...",
  "data": [
    { "name": "Feature", "value": "..." },
    { "name": "Price", "value": "..." }
  ]
}
```

### 4. Generic Data Format
Best for flexible/custom data structures.
```json
{
  "summary": "...",
  "items": [
    { "field1": "value1", "field2": "value2" }
  ]
}
```

## Tips for Best Results

### 1. Be Specific in Your Prompt
❌ Bad: "Find frameworks"
✅ Good: "Find modern JavaScript web frameworks from 2025+ with GitHub star counts"

### 2. Match Mode to Task
- **Comparison** mode → Use for tool/product comparisons
- **Research** mode → Use for academic/paper discovery
- **Documentation** mode → Use for setup/guide discovery
- **News** mode → Use for recent articles/events

### 3. Choose Right Output Format
- **Search Results** → Multiple diverse sources
- **Articles** → Content with dates/authors
- **Structured Data** → Comparing features/specs
- **Generic Data** → Custom/flexible data

### 4. Adjust Steps for Complexity
- Simple queries: 20-30 steps
- Medium queries: 30-45 steps
- Complex queries: 45-60 steps

### 5. Refine Results Through Follow-up
Run multiple searches:
1. Broad initial search
2. Refine based on results
3. Deep dive on specific findings

## File Outputs

All results are saved as JSON in the current directory:

```
search_results_[timestamp].json      # Format 1
articles_[timestamp].json            # Format 2
webpage_data_[timestamp].json        # Format 3
generic_data_[timestamp].json        # Format 4
```

Each file includes:
- Timestamp of execution
- Research mode used
- Original prompt
- Complete extracted data
- Metadata (model, search settings, etc.)

## Troubleshooting

### "No relevant results found"
- Try different keywords
- Increase max steps (40-50)
- Switch to "deep" mode for comprehensive search

### "Schema validation failed"
- Try different output format
- Refine your prompt to be more specific
- Reduce complexity of the task

### "Agent stopped early"
- Your task completed successfully (this is good!)
- Or: Increase max steps if you want more results

### "Azure OpenAI authentication error"
- Check `.env` has correct API key
- Verify endpoint URL format
- Ensure API key is not expired

## Advanced Customization

### Creating Custom Modes

Edit `config.js` to add your own mode:

```javascript
export const ScraperConfigs = {
  custom: {
    description: "Your custom description",
    maxSteps: 40,
    model: "azure/gpt-4o-mini",
    systemPrompt: `Your custom system prompt...`,
    useSearch: true,
  },
  // ... existing modes
};
```

### Modifying System Prompts

Each mode has a `systemPrompt` that guides the agent. Customize for your needs:

```javascript
systemPrompt: `You are a [role].
Your focus areas:
1. [Focus],
2. [Focus]

Guidelines:
- Guideline 1
- Guideline 2`,
```

## Performance Metrics

| Research Mode | Avg Steps | Avg Time | Best For |
|---|---|---|---|
| quick | 10-20 | 30-60s | Quick facts |
| default | 25-35 | 1-2min | General research |
| news | 30-40 | 1-2min | Recent content |
| comparison | 35-45 | 2-3min | Multiple sources |
| research | 40-50 | 2-3min | Academic sources |
| documentation | 40-50 | 2-4min | Technical docs |
| repos | 40-50 | 2-4min | Code discovery |
| ecommerce | 35-45 | 2-3min | Product data |
| jobs | 35-45 | 2-3min | Job data |
| deep | 50-60 | 3-5min | Comprehensive |

## Resources

- [Stagehand Docs](https://docs.stagehand.dev)
- [Brave Search](https://search.brave.com) (built-in)
- [Azure OpenAI](https://azure.microsoft.com/en-us/products/ai-services/openai-service/)
- [Zod Schemas](https://zod.dev)

---

**Last Updated:** March 26, 2026
**Framework:** Stagehand v3.0
**Model:** Azure OpenAI GPT-4o mini
**Search Tool:** Brave Search (built-in)
