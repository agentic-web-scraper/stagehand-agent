# Stagehand Tools and Modes - Complete Documentation

## Table of Contents
1. [Core Tools](#core-tools)
2. [Page Interaction Methods](#page-interaction-methods)
3. [Agent Modes](#agent-modes)
4. [Custom Tools](#custom-tools)
5. [API Reference](#api-reference)
6. [Best Practices](#best-practices)

---

## Core Tools

Stagehand provides three core tools that form the foundation of browser automation:

### 1. act() - Execute Actions

The `act()` method performs browser actions based on natural language instructions or structured action objects.

#### Method Signatures

```typescript
// String instruction only
await stagehand.act(instruction: string): Promise<ActResult>

// Action object only
await stagehand.act(action: Action): Promise<ActResult>

// String instruction with options
await stagehand.act(instruction: string, options: ActOptions): Promise<ActResult>
```

#### Action Interface

```typescript
interface Action {
  selector: string;        // XPath selector to locate element
  description: string;     // Human-readable description
  method: string;          // Action method (click, fill, type, press, etc.)
  arguments: string[];     // Additional action parameters
}
```

#### ActOptions Interface

```typescript
interface ActOptions {
  model?: ModelConfiguration;
  variables?: Record<string, VariableValue>;
  timeout?: number;
  page?: PlaywrightPage | PuppeteerPage | PatchrightPage | Page;
  serverCache?: boolean;
}
```

#### Examples

**Using a string instruction:**
```typescript
await stagehand.act("Click the login button");
```

**Using a structured action:**
```typescript
await stagehand.act({
  selector: ".login-button",
  description: "Click the primary login button",
  method: "click",
  arguments: []
});
```

**Using a string instruction with options:**
```typescript
await stagehand.act("Fill out the username field", {
  model: "openai/gpt-4o",
  variables: {
    username: "testuser"
  },
  timeout: 60000
});
```

#### Supported Action Methods

- **click** - Click on an element
- **fill** - Fill input/textarea elements
- **type** - Type text into an element
- **press** - Press keyboard keys
- **hover** - Hover over an element
- **scroll** - Scroll the page
- **dragAndDrop** - Drag and drop between points

---

### 2. extract() - Extract Structured Data

The `extract()` method retrieves structured data from web pages based on instructions and Zod schemas.

#### Method Signatures

```typescript
await stagehand.extract(
  instruction: string,
  schema: ZodTypeAny,
  options?: ExtractOptions
): Promise<T>
```

#### ExtractOptions Interface

```typescript
interface ExtractOptions {
  model?: ModelConfiguration;
  timeout?: number;
  selector?: string;  // XPath or CSS selector to scope extraction
  page?: PlaywrightPage | PuppeteerPage | PatchrightPage | Page;
  serverCache?: boolean;
}
```

#### Examples

**Basic extraction:**
```typescript
const price = await stagehand.extract(
  "extract the price",
  z.number()
);
```

**Structured extraction with schema:**
```typescript
const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  description: z.string()
});

const product = await stagehand.extract(
  "extract product information",
  ProductSchema
);
```

**Scoped extraction with selector:**
```typescript
const tableData = await stagehand.extract(
  "Extract the values of the third row",
  z.object({
    values: z.array(z.string())
  }),
  {
    selector: "xpath=/html/body/div/table/"
  }
);
```

**Array extraction:**
```typescript
const items = await stagehand.extract(
  "extract all product items",
  z.array(z.object({
    name: z.string(),
    price: z.number()
  }))
);
```

#### Best Practices for Extraction

- **Use selectors** to reduce token usage and improve accuracy
- **Break large extractions** into smaller chunks (page by page)
- **Set timeouts** for long-running extractions (60000ms recommended)
- **Use descriptive instructions** for better results

---

### 3. observe() - Discover Page Actions

The `observe()` method discovers actionable elements on the current page based on natural language queries.

#### Method Signatures

```typescript
await stagehand.observe(
  query: string,
  options?: ObserveOptions
): Promise<Action[]>
```

#### ObserveOptions Interface

```typescript
interface ObserveOptions {
  selector?: string;  // XPath selector to scope observation
  page?: Page;
  model?: string | object;
  timeout?: number;
  variables?: Record<string, any>;
}
```

#### Examples

**Basic observation:**
```typescript
const actions = await stagehand.observe("find submit buttons");
```

**Scoped observation:**
```typescript
const formActions = await stagehand.observe(
  "find all form inputs",
  { selector: "/html/body/form" }
);
```

**Observe → Extract Workflow:**
```typescript
const tables = await stagehand.observe("find data tables");
if (tables.length > 0) {
  const data = await stagehand.extract({
    instruction: "extract the table data",
    selector: tables[0].selector,
    schema: DataSchema
  });
}
```

#### Response Format

```typescript
interface Action {
  selector: string;        // XPath selector to locate element
  description: string;     // Human-readable description
  method?: string;         // Suggested action method
  arguments?: string[];    // Additional action parameters
}
```

---

## Page Interaction Methods

These methods are available on the `page` object for direct browser interactions:

### Navigation

```typescript
// Navigate to a URL
await page.goto("https://example.com");
await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
```

### Clicking

```typescript
// Click at coordinates
await page.click(100, 200);

// Double click
await page.click(100, 200, { clickCount: 2 });

// Click and get the XPath of the clicked element
const xpath = await page.click(100, 200, { returnXpath: true });

// Click using locator
const button = page.locator("button.submit");
await button.click();
```

### Hovering

```typescript
// Hover at coordinates
await page.hover(300, 150);

// Hover and get the XPath
const hoverXpath = await page.hover(300, 150, { returnXpath: true });
```

### Scrolling

```typescript
// Scroll down at a position (x, y, deltaX, deltaY)
await page.scroll(400, 300, 0, 200);  // scroll down 200px
```

### Drag and Drop

```typescript
// Drag and drop between two points
const [fromXpath, toXpath] = await page.dragAndDrop(
  100, 100,  // from coordinates
  300, 300,  // to coordinates
  { returnXpath: true }
);
```

### Typing

```typescript
// Type text
await page.type("Hello, World!");

// Type with delay between keystrokes
await page.type("Slow typing", { delay: 100 });
```

### Filling Input Fields

```typescript
// Fill using locator
const emailInput = page.locator("input[name=email]");
await emailInput.fill("user@example.com");

// Fill input, textarea, or contenteditable elements
await locator.fill(value: string);
```

### Element Locators

```typescript
// Find elements using CSS selectors
const button = page.locator("button[type=submit]");
const input = page.locator("input[name=email]");
const searchBox = page.locator("input[type=search]");

// Interact with located elements
await button.click();
await input.fill("value");
await searchBox.type("search term", { delay: 100 });
```

---

## Agent Modes

Stagehand offers three distinct modes for creating agents, each with different capabilities and use cases:

### 1. DOM Mode (Default)

**Best for:** Web scraping, data extraction, structured interactions

#### Characteristics
- ✅ Optimized for data extraction
- ✅ Lower token usage (cost-effective)
- ✅ Faster performance
- ✅ Works with any model
- ✅ Reliable for pagination and navigation
- ✅ Uses semantic interactions (accessibility trees)
- ❌ Limited for complex visual interactions

#### Configuration

```typescript
const agent = stagehand.agent({
  mode: "dom",
  model: "azure/gpt-4o-mini",
  systemPrompt: "You are a web scraping agent"
});

await agent.execute({
  instruction: "Extract all product titles and prices",
  maxSteps: 50
});
```

#### Tools Available in DOM Mode
- `act()` - Semantic actions
- `extract()` - Data extraction
- `observe()` - Element discovery
- `fillForm()` - Form filling
- Custom tools

#### Use Cases
- Web scraping
- Data extraction
- Form filling
- Page navigation
- Pagination handling

---

### 2. CUA Mode (Computer Use Agent)

**Best for:** Complex UI interactions, visual navigation, human-like interactions

#### Characteristics
- ✅ Uses computer vision for interactions
- ✅ Interacts like humans do
- ✅ Better for complex UI elements
- ✅ Handles visual elements well
- ❌ Higher token usage
- ❌ Slower performance
- ❌ Requires specific models

#### Configuration

```typescript
const agent = stagehand.agent({
  mode: "cua",
  model: "google/gemini-2.5-computer-use-preview-10-2025"
});

await agent.execute({
  instruction: "Fill out the registration form",
  maxSteps: 20
});
```

#### Supported Models for CUA
- `google/gemini-2.5-computer-use-preview-10-2025`
- `openai/computer-use-preview`
- `anthropic/claude-sonnet-4-20250514`

#### Tools Available in CUA Mode
- Coordinate-based clicking
- Visual form filling
- Screenshot-based navigation
- Custom tools

#### Use Cases
- Complex form interactions
- Visual element navigation
- Screenshot-based automation
- Advanced UI interactions

---

### 3. Hybrid Mode

**Best for:** Complex tasks requiring both DOM and visual understanding

#### Characteristics
- ✅ Combines DOM and CUA approaches
- ✅ Maximum reliability across environments
- ✅ Uses both semantic and visual understanding
- ✅ Better for mixed interaction types
- ⚠️ Requires `experimental: true` flag
- ⚠️ Requires specific vision-capable models
- ❌ Higher token usage than DOM mode

#### Configuration

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  experimental: true,  // Required for hybrid mode
  localBrowserLaunchOptions: {
    headless: false,
    viewport: { width: 1280, height: 720 }
  }
});

await stagehand.init();

const agent = stagehand.agent({
  mode: "hybrid",
  model: "google/gemini-3-flash-preview",
  systemPrompt: "You are a helpful assistant that interacts with web pages visually"
});

await agent.execute({
  instruction: "Click the sign up button and fill out the registration form",
  maxSteps: 20,
  highlightCursor: true
});
```

#### Supported Models for Hybrid
- `google/gemini-3-flash-preview`
- `anthropic/claude-haiku-4-5-20251001`
- `anthropic/claude-sonnet-4-20250514`

#### Tools Available in Hybrid Mode
- DOM-based tools (act, extract, observe)
- Coordinate-based tools (click, type)
- Visual understanding
- Custom tools

#### Use Cases
- Complex workflows with mixed interactions
- Fallback when one approach fails
- Maximum reliability requirements
- Advanced automation scenarios

---

## Mode Comparison Table

| Feature | DOM | CUA | Hybrid |
|---------|-----|-----|--------|
| **Best for** | Data extraction | Complex UI | Mixed tasks |
| **Token usage** | Low | High | Medium-High |
| **Speed** | Fast | Slow | Medium |
| **Cost** | Low | High | Medium |
| **Model support** | Any | Specific | Specific |
| **Visual understanding** | No | Yes | Yes |
| **Semantic understanding** | Yes | No | Yes |
| **Pagination** | Excellent | Good | Excellent |
| **Form filling** | Good | Excellent | Excellent |
| **Experimental flag** | No | No | Yes |

---

## Custom Tools

Custom tools extend agent capabilities with domain-specific functionality.

### Defining Custom Tools

```typescript
import { tool } from "@browserbasehq/stagehand";
import { z } from "zod";

const customTools = {
  filterData: tool({
    description: "Filter extracted data by specific criteria",
    parameters: z.object({
      items: z.array(z.record(z.string(), z.any())),
      filterField: z.string(),
      filterValue: z.any(),
      operator: z.enum(["equals", "contains", "greaterThan", "lessThan"])
    }),
    execute: async ({ items, filterField, filterValue, operator }) => {
      const filtered = items.filter(item => {
        const fieldValue = item[filterField];
        switch (operator) {
          case "equals":
            return fieldValue === filterValue;
          case "contains":
            return String(fieldValue).includes(String(filterValue));
          case "greaterThan":
            return Number(fieldValue) > Number(filterValue);
          case "lessThan":
            return Number(fieldValue) < Number(filterValue);
          default:
            return false;
        }
      });
      return { filteredCount: filtered.length, items: filtered };
    }
  })
};
```

### Using Custom Tools with Agent

```typescript
const agent = stagehand.agent({
  mode: "dom",
  model: "azure/gpt-4o-mini",
  tools: customTools
});

await agent.execute({
  instruction: "Scrape products and filter by price > 50",
  maxSteps: 50
});
```

### Common Custom Tools

1. **Data Filtering** - Filter items by criteria
2. **Data Sorting** - Sort by field
3. **Deduplication** - Remove duplicates
4. **Field Extraction** - Extract specific fields
5. **Statistics** - Calculate statistics
6. **Data Transformation** - Transform data format
7. **Validation** - Validate extracted data
8. **Aggregation** - Aggregate data

---

## API Reference

### ModelConfiguration Type

```typescript
type ModelConfiguration =
  | string  // Format: "provider/model" (e.g., "openai/gpt-4o", "anthropic/claude-sonnet-4-6")
  | {
      modelName: string;  // The model name
      apiKey?: string;    // Optional: API key override
      baseURL?: string;   // Optional: Base URL override
    };
```

### VariableValue Type

```typescript
type VariableValue =
  | string
  | number
  | boolean
  | { value: string | number | boolean; description?: string };
```

### ActResult Interface

```typescript
interface ActResult {
  success: boolean;
  message?: string;
  error?: string;
}
```

### Agent Execute Options

```typescript
interface ExecuteOptions {
  instruction: string;           // Natural language instruction
  maxSteps: number;              // Maximum steps to execute
  output?: ZodTypeAny;           // Optional output schema
  highlightCursor?: boolean;     // Highlight cursor in hybrid mode
  variables?: Record<string, any>;
  timeout?: number;
}
```

---

## Best Practices

### 1. Choosing the Right Mode

```typescript
// For web scraping → Use DOM mode
const scrapingAgent = stagehand.agent({
  mode: "dom",
  model: "azure/gpt-4o-mini"
});

// For complex UI interactions → Use CUA mode
const uiAgent = stagehand.agent({
  mode: "cua",
  model: "google/gemini-2.5-computer-use-preview-10-2025"
});

// For mixed tasks → Use Hybrid mode
const hybridAgent = stagehand.agent({
  mode: "hybrid",
  model: "google/gemini-3-flash-preview"
});
```

### 2. Optimizing Extraction

```typescript
// ✅ Good: Scoped extraction with selector
const data = await stagehand.extract(
  "extract product data",
  ProductSchema,
  { selector: "xpath=/html/body/div/products" }
);

// ❌ Avoid: Extracting entire page
const data = await stagehand.extract(
  "extract product data from entire page",
  ProductSchema
);
```

### 3. Handling Pagination

```typescript
// ✅ Good: Let agent handle pagination
const agent = stagehand.agent({ mode: "dom" });
await agent.execute({
  instruction: "Scrape 50 items across multiple pages",
  maxSteps: 100
});

// ✅ Alternative: Manual pagination with extraction
const allData = [];
for (let page = 1; page <= 3; page++) {
  await stagehand.act(`navigate to page ${page}`);
  const pageData = await stagehand.extract(
    "extract items from current page",
    z.array(ItemSchema),
    { timeout: 60000 }
  );
  allData.push(...pageData);
}
```

### 4. Error Handling

```typescript
try {
  const result = await agent.execute({
    instruction: "Scrape data",
    maxSteps: 50
  });
} catch (error) {
  console.error("Execution failed:", error.message);
  // Fallback logic
}
```

### 5. Using Custom Tools Effectively

```typescript
const agent = stagehand.agent({
  mode: "dom",
  tools: {
    filterData: filterTool,
    sortData: sortTool,
    deduplicateData: deduplicateTool
  },
  systemPrompt: `You have access to custom tools for data processing.
    After extracting data, use these tools to clean and organize it.`
});
```

### 6. Performance Optimization

```typescript
// ✅ Use serverCache for repeated operations
await stagehand.extract(instruction, schema, {
  serverCache: true
});

// ✅ Set appropriate timeouts
await stagehand.extract(instruction, schema, {
  timeout: 60000  // 60 seconds
});

// ✅ Use variables for dynamic content
await stagehand.act("Fill username", {
  variables: { username: "testuser" }
});
```

---

## Summary

| Tool/Mode | Purpose | Best For | Cost |
|-----------|---------|----------|------|
| **act()** | Execute actions | Clicking, typing, navigation | Low |
| **extract()** | Get structured data | Data scraping | Low |
| **observe()** | Discover elements | Finding interactive elements | Low |
| **DOM Mode** | Semantic automation | Web scraping, data extraction | Low |
| **CUA Mode** | Visual automation | Complex UI interactions | High |
| **Hybrid Mode** | Combined approach | Mixed interaction types | Medium |
| **Custom Tools** | Domain logic | Data processing, validation | Low |

---

## References

- [Stagehand Documentation](https://docs.stagehand.dev)
- [Stagehand GitHub](https://github.com/browserbase/stagehand)
- [Browserbase](https://www.browserbase.com)
