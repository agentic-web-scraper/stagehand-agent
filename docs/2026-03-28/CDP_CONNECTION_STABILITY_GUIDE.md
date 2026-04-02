# CDP Connection Stability Guide

## Problem

When running long operations with Lightpanda + Stagehand, the CDP connection closes prematurely with:
```
ERROR: CDP transport closed: socket-close code=1006 reason=
ERROR: Error executing agent task: Cannot read properties of null (reading 'awaitActivePage')
```

This prevents the agent from completing tasks and saving results.

## Root Causes

1. **Lightpanda timeout** - Default CDP session timeout
2. **Network idle timeout** - No activity on the connection
3. **Memory pressure** - Lightpanda running out of resources
4. **Long-running operations** - Agent takes too long between actions
5. **No keepalive** - Connection not maintained during idle periods

## Solutions

### Solution 1: Enable keepAlive in Stagehand (Recommended)

**What it does:** Keeps the browser session alive even during idle periods

```javascript
const stagehand = new Stagehand({
  env: "LOCAL",
  model: "azure/gpt-4o-mini",
  experimental: true,
  keepAlive: true,  // ✅ Keep session alive
  localBrowserLaunchOptions: {
    cdpUrl: "ws://127.0.0.1:9222",
  },
});
```

**Benefits:**
- ✅ Prevents timeout during long operations
- ✅ Browser stays alive between tasks
- ✅ Can reconnect if needed

---

### Solution 2: Increase Lightpanda Timeout

**What it does:** Start Lightpanda with longer timeout settings

```bash
# Start with custom timeout (example - check Lightpanda docs for actual flags)
./lightpanda serve \
  --host 127.0.0.1 \
  --port 9222 \
  --timeout 3600 \
  --keepalive-interval 30
```

**Note:** Check Lightpanda documentation for actual timeout flags. The above is conceptual.

---

### Solution 3: Add Connection Monitoring and Reconnection

**What it does:** Detect disconnections and reconnect automatically

```javascript
async function createStableConnection() {
  let stagehand;
  let reconnectAttempts = 0;
  const maxReconnects = 3;

  async function connect() {
    stagehand = new Stagehand({
      env: "LOCAL",
      model: "azure/gpt-4o-mini",
      experimental: true,
      keepAlive: true,
      localBrowserLaunchOptions: {
        cdpUrl: "ws://127.0.0.1:9222",
      },
    });

    await stagehand.init();
    return stagehand;
  }

  async function reconnect() {
    if (reconnectAttempts >= maxReconnects) {
      throw new Error('Max reconnection attempts reached');
    }
    
    reconnectAttempts++;
    console.log(`Reconnecting... (attempt ${reconnectAttempts})`);
    
    try {
      await stagehand.close();
    } catch (e) {
      // Ignore close errors
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await connect();
  }

  stagehand = await connect();
  
  return {
    stagehand,
    reconnect,
  };
}

// Usage
const { stagehand, reconnect } = await createStableConnection();

try {
  const agent = stagehand.agent({...});
  const result = await agent.execute({...});
} catch (error) {
  if (error.message.includes('CDP') || error.message.includes('transport')) {
    console.log('Connection lost, reconnecting...');
    const { stagehand: newStagehand } = await reconnect();
    // Retry operation with new connection
  }
}
```

---

### Solution 4: Break Long Operations into Chunks

**What it does:** Split large scraping tasks into smaller batches

```javascript
async function scrapeInChunks(totalBooks, booksPerChunk = 20) {
  const allBooks = [];
  const chunks = Math.ceil(totalBooks / booksPerChunk);
  
  for (let i = 0; i < chunks; i++) {
    console.log(`Scraping chunk ${i + 1}/${chunks}`);
    
    // Create fresh connection for each chunk
    const stagehand = new Stagehand({
      env: "LOCAL",
      model: "azure/gpt-4o-mini",
      experimental: true,
      keepAlive: true,
      localBrowserLaunchOptions: {
        cdpUrl: "ws://127.0.0.1:9222",
      },
    });
    
    await stagehand.init();
    const page = await stagehand.context.newPage();
    
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",
      tools: { duckduckgoSearch: duckduckgoSearchTool },
    });
    
    try {
      const result = await agent.execute({
        instruction: `Scrape ${booksPerChunk} books from page ${i + 1}`,
        page: page,
        maxSteps: 20,
        output: BooksSchema,
      });
      
      allBooks.push(...result.output.books);
      
      // Save intermediate results
      fs.writeFileSync(
        `books_chunk_${i + 1}.json`,
        JSON.stringify(result.output.books, null, 2)
      );
      
    } finally {
      await stagehand.close();
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return allBooks;
}

// Usage
const books = await scrapeInChunks(40, 20);  // 40 books in chunks of 20
```

---

### Solution 5: Add Heartbeat/Ping Mechanism

**What it does:** Keep connection alive with periodic activity

```javascript
class StagehandWithHeartbeat {
  constructor(options) {
    this.options = options;
    this.stagehand = null;
    this.heartbeatInterval = null;
  }
  
  async init() {
    this.stagehand = new Stagehand(this.options);
    await this.stagehand.init();
    
    // Start heartbeat - perform small action every 30 seconds
    this.heartbeatInterval = setInterval(async () => {
      try {
        const pages = this.stagehand.context.pages();
        if (pages.length > 0) {
          // Small action to keep connection alive
          await pages[0].evaluate(() => document.title);
          console.log('💓 Heartbeat: Connection alive');
        }
      } catch (error) {
        console.error('💔 Heartbeat failed:', error.message);
        clearInterval(this.heartbeatInterval);
      }
    }, 30000);  // Every 30 seconds
    
    return this.stagehand;
  }
  
  async close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.stagehand) {
      await this.stagehand.close();
    }
  }
}

// Usage
const wrapper = new StagehandWithHeartbeat({
  env: "LOCAL",
  model: "azure/gpt-4o-mini",
  experimental: true,
  keepAlive: true,
  localBrowserLaunchOptions: {
    cdpUrl: "ws://127.0.0.1:9222",
  },
});

await wrapper.init();
// Use wrapper.stagehand for operations
await wrapper.close();
```

---

### Solution 6: Reduce Agent Complexity

**What it does:** Simplify agent operations to reduce execution time

```javascript
// Instead of: "Scrape 40 books from booktoscrape.com"
// Use more specific instructions:

const agent = stagehand.agent({
  model: "azure/gpt-4o-mini",
  systemPrompt: `You are a fast, efficient scraper.
  
  RULES:
  - Extract data quickly
  - Don't overthink
  - Use simple selectors
  - Minimize steps`,
});

await agent.execute({
  instruction: "Go to booktoscrape.com, extract 20 books from current page only",
  page: page,
  maxSteps: 10,  // Reduce max steps
  output: BooksSchema,
});
```

---

### Solution 7: Use Stagehand's Built-in Timeout Settings

**What it does:** Configure timeouts at Stagehand level

```javascript
const stagehand = new Stagehand({
  env: "LOCAL",
  model: "azure/gpt-4o-mini",
  experimental: true,
  keepAlive: true,
  domSettleTimeout: 5000,  // Wait for DOM to settle (ms)
  localBrowserLaunchOptions: {
    cdpUrl: "ws://127.0.0.1:9222",
    connectTimeoutMs: 60000,  // Connection timeout (60s)
  },
});
```

---

### Solution 8: Monitor and Handle Errors Gracefully

**What it does:** Catch errors and save partial results

```javascript
async function scrapeWithErrorHandling(instruction, maxSteps = 30) {
  const stagehand = new Stagehand({
    env: "LOCAL",
    model: "azure/gpt-4o-mini",
    experimental: true,
    keepAlive: true,
    localBrowserLaunchOptions: {
      cdpUrl: "ws://127.0.0.1:9222",
    },
  });
  
  let partialResults = [];
  
  try {
    await stagehand.init();
    const page = await stagehand.context.newPage();
    
    const agent = stagehand.agent({
      model: "azure/gpt-4o-mini",
      callbacks: {
        onStep: (step) => {
          console.log(`Step ${step.stepNumber}: ${step.action}`);
          
          // Save partial results if available
          if (step.output) {
            partialResults.push(step.output);
            fs.writeFileSync(
              'partial_results.json',
              JSON.stringify(partialResults, null, 2)
            );
          }
        },
      },
    });
    
    const result = await agent.execute({
      instruction: instruction,
      page: page,
      maxSteps: maxSteps,
      output: BooksSchema,
    });
    
    return result.output;
    
  } catch (error) {
    console.error('Error during scraping:', error.message);
    
    // Return partial results if available
    if (partialResults.length > 0) {
      console.log(`Returning ${partialResults.length} partial results`);
      return { books: partialResults };
    }
    
    throw error;
    
  } finally {
    try {
      await stagehand.close();
    } catch (e) {
      // Ignore close errors
    }
  }
}
```

---

## Recommended Approach (Combination)

For best stability, combine multiple solutions:

```javascript
import { Stagehand, tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import fs from 'fs';

// Solution 4: Chunk-based scraping
async function scrapeWithStability(totalBooks, booksPerChunk = 20) {
  const allBooks = [];
  const chunks = Math.ceil(totalBooks / booksPerChunk);
  
  for (let i = 0; i < chunks; i++) {
    console.log(`\n📦 Chunk ${i + 1}/${chunks}`);
    
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        // Solution 1: keepAlive enabled
        const stagehand = new Stagehand({
          env: "LOCAL",
          model: "azure/gpt-4o-mini",
          experimental: true,
          keepAlive: true,  // ✅ Keep alive
          domSettleTimeout: 5000,  // Solution 7
          localBrowserLaunchOptions: {
            cdpUrl: "ws://127.0.0.1:9222",
            connectTimeoutMs: 60000,  // Solution 7
          },
        });
        
        await stagehand.init();
        const page = await stagehand.context.newPage();
        
        const agent = stagehand.agent({
          model: "azure/gpt-4o-mini",
          systemPrompt: "You are a fast, efficient scraper. Extract data quickly.",  // Solution 6
        });
        
        // Solution 6: Specific, simple instructions
        const result = await agent.execute({
          instruction: `Go to booktoscrape.com page ${i + 1}, extract ${booksPerChunk} books`,
          page: page,
          maxSteps: 15,  // Reduced steps
          output: BooksSchema,
        });
        
        allBooks.push(...result.output.books);
        
        // Solution 8: Save intermediate results
        fs.writeFileSync(
          `books_chunk_${i + 1}.json`,
          JSON.stringify(result.output.books, null, 2)
        );
        
        await stagehand.close();
        
        // Success - break retry loop
        break;
        
      } catch (error) {
        retries++;
        console.error(`❌ Chunk ${i + 1} failed (attempt ${retries}):`, error.message);
        
        if (retries >= maxRetries) {
          console.error(`⚠️  Skipping chunk ${i + 1} after ${maxRetries} attempts`);
          break;
        }
        
        // Solution 3: Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Small delay between chunks
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Combine all chunks
  fs.writeFileSync(
    `books_all_${Date.now()}.json`,
    JSON.stringify({ books: allBooks, total: allBooks.length }, null, 2)
  );
  
  return allBooks;
}

// Usage
const books = await scrapeWithStability(40, 20);
console.log(`✅ Total books scraped: ${books.length}`);
```

---

## Quick Fixes Summary

| Solution | Difficulty | Effectiveness | When to Use |
|----------|-----------|---------------|-------------|
| 1. keepAlive | Easy | Medium | Always |
| 2. Lightpanda timeout | Easy | Low | If supported |
| 3. Reconnection | Medium | High | Critical operations |
| 4. Chunking | Easy | High | Large datasets |
| 5. Heartbeat | Medium | Medium | Very long operations |
| 6. Simplify agent | Easy | Medium | Complex tasks |
| 7. Timeouts | Easy | Low | Fine-tuning |
| 8. Error handling | Medium | High | Production |

---

## Testing Connection Stability

```javascript
// Test script to measure connection stability
async function testConnectionStability(durationMinutes = 5) {
  const stagehand = new Stagehand({
    env: "LOCAL",
    model: "azure/gpt-4o-mini",
    experimental: true,
    keepAlive: true,
    localBrowserLaunchOptions: {
      cdpUrl: "ws://127.0.0.1:9222",
    },
  });
  
  await stagehand.init();
  const page = await stagehand.context.newPage();
  
  const startTime = Date.now();
  const endTime = startTime + (durationMinutes * 60 * 1000);
  let checks = 0;
  let failures = 0;
  
  console.log(`Testing connection for ${durationMinutes} minutes...`);
  
  while (Date.now() < endTime) {
    try {
      await page.evaluate(() => document.title);
      checks++;
      console.log(`✅ Check ${checks}: Connection alive`);
    } catch (error) {
      failures++;
      console.error(`❌ Check ${checks}: Connection failed`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000));  // Every 10s
  }
  
  await stagehand.close();
  
  console.log(`\nResults:`);
  console.log(`  Total checks: ${checks}`);
  console.log(`  Failures: ${failures}`);
  console.log(`  Success rate: ${((checks - failures) / checks * 100).toFixed(2)}%`);
}

// Run test
await testConnectionStability(5);
```

---

## Conclusion

**Best Practice for Production:**

1. ✅ Enable `keepAlive: true`
2. ✅ Use chunking for large datasets (20-30 items per chunk)
3. ✅ Add retry logic with exponential backoff
4. ✅ Save intermediate results
5. ✅ Monitor connection health
6. ✅ Simplify agent instructions
7. ✅ Handle errors gracefully

This combination provides the most stable and reliable scraping experience with Lightpanda + Stagehand.

---

**Files:**
- This guide: `docs/CDP_CONNECTION_STABILITY_GUIDE.md`
- Working scraper: `web_scraping/autonomous_scraper_lightpanda.js`
- Enhanced version: `web_scraping/autonomous_scraper_lightpanda_stable.js` (to be created)

**Last Updated**: March 28, 2026
