# Stagehand Complete Reference from Context7

## Overview

Stagehand is an AI-powered browser automation framework that combines natural language instructions with deterministic code for reliable web automation. It supports multiple browser backends (local, Browserbase) and LLM providers.

**Source:** Context7 Documentation  
**Benchmark Score:** 88.75 (High Reputation)  
**Code Snippets:** 1555+

---

## Core API Methods

### 1. act() - Execute Browser Actions

**Description:** Executes targeted AI-guided interactions on the page (clicking, typing, navigating).

**Method Signatures:**
```typescript
await stagehand.act(instruction: string): Promise<ActResult>

await stagehand.act(action: Action): Promise<ActResult>

await stagehand.act(instruction: string, options: ActOptions): Promise<ActResult>
```

**Action Interface:**
```typescript
interface Action {
  selector: string;        // XPath selector to locate element
  description: string;     // Human-readable description
  method: string;          // Action method (click, fill, type, press, etc.)
  arguments: string[];     // Additional action parameters
}
```

**ActOptions Interface:**
```typescript
interface ActOptions {
  model?: ModelConfiguration;
  variables?: Record<string, VariableValue>;
  timeout?: number;
  page?: PlaywrightPage | PuppeteerPage | PatchrightPage | Page;
  serverCache?: boolean;
}
```

**Examples:**
```typescript
// Using string instruction
await stagehand.act("Click the login button");

// Using structured action
await stagehand.act({
  selector: ".login-button",
  description: "Click the primary login button",
  method: "click",
  arguments: []
});

// With options
await stagehand.act("Fill out the username field", {
  model: "openai/gpt-4o",
  variables: { username: "testuser" },
  timeout: 60000
});
```

---

### 2. extract() - Extract Structured Data

**Description:** Retrieves structured data from web pages based on instructions and Zod schemas.

**Method Signatures:**
```typescript
await stagehand.extract(): Promise<{ pageText: string }>

await stagehand.extract(options: ExtractOptions): Promise<{ pageText: string }>

await stagehand.extract(instruction: string): Promise<{ extraction: string }>

await stagehand.extract<T extends ZodTypeAny>(
  instruction: string,
  schema: T,
  options?: ExtractOptions
): Promise<z.infer<T>>
```

**ExtractOptions Interface:**
```typescript
interface ExtractOptions {
  model?: ModelConfiguration;
  timeout?: number;
  selector?: string;  // XPath or CSS selector to scope extraction
  page?: PlaywrightPage | PuppeteerPage | PatchrightPage | Page;
  serverCache?: boolean;
}
```

**Parameters:**
- **instruction** (string) - Optional - Natural language description of what to extract
- **schema** (ZodTypeAny) - Optional - Zod schema defining data structure
- **model** (ModelConfiguration) - Optional - AI model to use
- **timeout** (number) - Optional - Max time in milliseconds (default varies)
- **selector** (string) - Optional - XPath/CSS selector to limit scope
- **page** - Optional - Specify which page to extract from
- **serverCache** (boolean) - Optional - Enable/disable server-side caching

**Examples:**
```typescript
// Basic extraction
const price = await stagehand.extract(
  "extract the price",
  z.number()
);

// Structured extraction
const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  description: z.string()
});

const product = await stagehand.extract(
  "extract product information",
  ProductSchema
);

// Scoped extraction
const tableData = await stagehand.extract(
  "Extract the values of the third row",
  z.object({ values: z.array(z.string()) }),
  { selector: "xpath=/html/body/div/table/" }
);

// Array extraction
const items = await stagehand.extract(
  "extract all product items",
  z.array(z.object({
    name: z.string(),
    price: z.number()
  }))
);
```

**Notes:**
- Iframe and Shadow DOM interactions are supported out of the box
- Stagehand automatically handles iframe traversal and shadow DOM elements
- Return type is automatically inferred from the Zod schema

---

### 3. observe() - Discover Page Actions

**Description:** Discovers actionable elements on the current page based on natural language queries.

**Method Signatures:**
```typescript
await stagehand.observe(
  query: string,
  options?: ObserveOptions
): Promise<Action[]>
```

**ObserveOptions Interface:**
```typescript
interface ObserveOptions {
  selector?: string;  // XPath selector to scope observation
  page?: Page;
  model?: string | object;
  timeout?: number;
  variables?: Record<string, any>;
}
```

**Response Format:**
```typescript
interface Action {
  selector: string;        // XPath selector to locate element
  description: string;     // Human-readable description
  method?: string;         // Suggested action method
  arguments?: string[];    // Additional action parameters
}
```

**Examples:**
```typescript
// Basic observation
const actions = await stagehand.observe("find submit buttons");

// Scoped observation
const formActions = await stagehand.observe(
  "find all form inputs",
  { selector: "/html/body/form" }
);

// Observe → Extract workflow
const tables = await stagehand.observe("find data tables");
if (tables.length > 0) {
  const data = await stagehand.extract({
    instruction: "extract the table data",
    selector: tables[0].selector,
    schema: DataSchema
  });
}
```

---

### 4. agent() - Autonomous Multi-Step Workflows

**Description:** Creates an autonomous agent that can execute complex, multi-step workflows with AI decision-making.

**Method Signature:**
```typescript
const agent = stagehand.agent(options: AgentOptions);

interface AgentOptions {
  model?: ModelConfiguration;
  systemPrompt?: string;
  mode?: "dom" | "cua" | "hybrid";
  tools?: Record<string, Tool>;
  stream?: boolean;
}
```

**Agent Execute:**
```typescript
const result = await agent.execute({
  instruction: string;           // Natural language instruction
  maxSteps: number;              // Maximum steps to execute
  output?: ZodTypeAny;           // Optional output schema
  highlightCursor?: boolean;     // Highlight cursor in hybrid mode
  variables?: Record<string, any>;
  timeout?: number;
});
```

**Example:**
```typescript
const agent = stagehand.agent({
  model: "azure/gpt-4o-mini",
  systemPrompt: "You are an expert web scraping agent...",
  mode: "dom"
});

const result = await agent.execute({
  instruction: "Scrape top 50 products and sort by price",
  maxSteps: 30,
  output: ProductSchema
});
```

---

## Stagehand Constructor & Configuration

### Initialization

```typescript
const stagehand = new Stagehand(options: V3Options);
```

### V3Options Interface

```typescript
interface V3Options {
  // Environment selection
  env: "LOCAL" | "BROWSERBASE";

  // Browserbase options (required when env = "BROWSERBASE")
  apiKey?: string;
  projectId?: string;
  browserbaseSessionID?: string;
  browserbaseSessionCreateParams?: Browserbase.Sessions.SessionCreateParams;

  // Local browser options
  localBrowserLaunchOptions?: LocalBrowserLaunchOptions;

  // AI/LLM configuration
  model?: ModelConfiguration;
  llmClient?: LLMClient;
  systemPrompt?: string;

  // Behavior options
  selfHeal?: boolean;
  experimental?: boolean;
  domSettleTimeout?: number;
  cacheDir?: string;
  keepAlive?: boolean;
  serverCache?: boolean;

  // Logging options
  verbose?: 0 | 1 | 2;
  logInferenceToFile?: boolean;
  disablePino?: boolean;
  logger?: (line: LogLine) => void;
}
```

### Local Browser Launch Options

```typescript
interface LocalBrowserLaunchOptions {
  args?: string[];
  executablePath?: string;
  port?: number;
  userDataDir?: string;
  preserveUserDataDir?: boolean;
  headless?: boolean;
  devtools?: boolean;
  chromiumSandbox?: boolean;
  ignoreDefaultArgs?: boolean | string[];
  proxy?: {
    server: string;
    bypass?: string;
    username?: string;
    password?: string;
  };
  locale?: string;
  viewport?: { width: number; height: number };
  deviceScaleFactor?: number;
  hasTouch?: boolean;
  ignoreHTTPSErrors?: boolean;
  cdpUrl?: string;
  cdpHeaders?: Record<string, string>;
  connectTimeoutMs?: number;
  downloadsPath?: string;
  acceptDownloads?: boolean;
}
```

### Configuration Examples

**Local Browser:**
```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  localBrowserLaunchOptions: {
    headless: false,
    devtools: true,
    viewport: { width: 1280, height: 720 },
    executablePath: '/opt/google/chrome/chrome',
    port: 9222,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
    ],
  },
});

await stagehand.init();
```

**Browserbase:**
```typescript
const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  browserbaseSessionCreateParams: {
    proxies: true,
    region: "us-west-2",
    browserSettings: {
      viewport: { width: 1920, height: 1080 },
      blockAds: true,
    },
  },
});

await stagehand.init();
```

---

## Context Methods

### Browser Context API

```typescript
// Create new page
const page = await stagehand.context.newPage(url?: string): Promise<Page>

// Get all pages
const pages = stagehand.context.pages(): Page[]

// Get active page
const activePage = stagehand.context.activePage(): Page | undefined

// Set active page
stagehand.context.setActivePage(page: Page): void

// Set HTTP headers
await stagehand.context.setExtraHTTPHeaders(headers: Record<string, string>): Promise<void>

// Get cookies
const cookies = await stagehand.context.cookies(urls?: string | string[]): Promise<Cookie[]>

// Add cookies
await stagehand.context.addCookies(cookies: CookieParam[]): Promise<void>

// Clear cookies
await stagehand.context.clearCookies(options?: ClearCookieOptions): Promise<void>

// Close context
await stagehand.context.close(): Promise<void>
```

---

## Response Object Methods

### Status & Metadata

```typescript
// Get final URL
response.url(): string

// Get HTTP status code
response.status(): number

// Get status text
response.statusText(): string

// Check if response is OK (2xx)
response.ok(): boolean

// Get frame that initiated navigation
response.frame(): Frame | null

// Check if from Service Worker
response.fromServiceWorker(): boolean

// Get TLS/security details
await response.securityDetails(): Promise<SecurityDetails | null>

// Get remote IP/port
await response.serverAddr(): Promise<{ ipAddress: string; port: number } | null>
```

---

## Model Configuration

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

### Supported Models

**Azure OpenAI:**
- `azure/gpt-4o-mini` (recommended for cost)
- `azure/gpt-4o`

**OpenAI:**
- `openai/gpt-4o`
- `openai/gpt-4-turbo`

**Google Gemini:**
- `google/gemini-2.5-flash`
- `google/gemini-2.5-computer-use-preview` (CUA mode)

**Anthropic Claude:**
- `anthropic/claude-sonnet-4-20250514`
- `anthropic/claude-haiku-4-5-20251001`

**NVIDIA NIM:**
- `nvidia/llama-3.1-8b`

---

## Agent Modes

### DOM Mode (Default)
- Best for: Standard web applications
- Uses: CSS selectors, XPath, natural language
- Speed: Fast
- Cost: Low
- Works with: Any LLM

### CUA Mode (Computer Use Agent)
- Best for: Complex layouts, visual reasoning
- Uses: Screenshots, computer vision
- Speed: Slower
- Cost: Higher
- Requires: Vision-capable models (Gemini, Claude)

### Hybrid Mode
- Best for: Mixed interaction types
- Uses: Both DOM and visual understanding
- Requires: `experimental: true` flag
- Models: Gemini 3 Flash, Claude Sonnet/Haiku

---

## Custom Tools

### Tool Definition Pattern

```typescript
import { tool } from "@browserbasehq/stagehand";
import { z } from "zod";

const customTool = tool({
  description: "What this tool does",
  parameters: z.object({
    param1: z.string().describe("Description of param1"),
    param2: z.number().describe("Description of param2"),
  }),
  execute: async ({ param1, param2 }) => {
    // Your implementation
    return { result: "..." };
  }
});
```

### Using Tools with Agent

```typescript
const agent = stagehand.agent({
  model: "azure/gpt-4o-mini",
  tools: {
    filterData: customFilterTool,
    sortData: customSortTool,
    deduplicateData: customDeduplicateTool,
  }
});

const result = await agent.execute({
  instruction: "Scrape products and filter by price",
  maxSteps: 40,
  output: ProductSchema
});
```

---

## Best Practices

### 1. Always Use Schemas
```typescript
// ✅ Good: Schema validation
const data = await stagehand.extract(
  "extract products",
  z.array(ProductSchema)
);

// ❌ Avoid: No schema
const data = await stagehand.extract("extract products");
```

### 2. Set Explicit Step Limits
```typescript
// ✅ Good: Bounded execution
const result = await agent.execute({
  instruction: "Scrape data",
  maxSteps: 30  // Prevents runaway costs
});

// ❌ Avoid: No limit
const result = await agent.execute({
  instruction: "Scrape data"
  // maxSteps defaults to 20, but be explicit
});
```

### 3. Use Selectors for Scoped Extraction
```typescript
// ✅ Good: Scoped extraction
const data = await stagehand.extract(
  "extract table data",
  TableSchema,
  { selector: "xpath=/html/body/table" }  // Reduces tokens
);

// ❌ Avoid: Full page extraction
const data = await stagehand.extract(
  "extract table data from entire page",
  TableSchema
);
```

### 4. Combine Deterministic + AI
```typescript
// ✅ Good: Hybrid approach
await page.goto(url);  // Deterministic navigation
const data = await stagehand.extract(
  "extract product data",
  ProductSchema  // AI-powered extraction
);

// ❌ Avoid: Pure AI navigation
const result = await agent.execute({
  instruction: "navigate to URL and extract data"
  // Less reliable than explicit navigation
});
```

### 5. Use Custom Tools for Post-Processing
```typescript
// ✅ Good: Deterministic tools
const filtered = await filterDataTool.execute({
  items: rawData,
  filterField: "price",
  operator: "lessThan",
  filterValue: 100
});

// ❌ Avoid: Repeated LLM calls
const filtered = await stagehand.extract(
  "filter products under $100",
  FilteredSchema
);
```

---

## Error Handling

### Common Issues & Solutions

**Schema Validation Error:**
- Cause: Model output doesn't match Zod schema
- Solution: Simplify schema or use stronger model

**Infinite Agent Loops:**
- Cause: No clear stopping condition
- Solution: Set explicit `maxSteps` and stopping criteria in system prompt

**Browser Timeout:**
- Cause: Page loading slowly or infinite scroll
- Solution: Set page timeout: `await page.goto(url, { timeout: 30000 })`

**Model Authentication:**
- Cause: Invalid credentials in `.env`
- Solution: Verify API keys and endpoint formats

---

## Performance Tips

| Operation | Optimization |
|-----------|--------------|
| **observe** | Use minimal, specific task descriptions |
| **act** | Prefer action objects from observe() over repeated natural language |
| **extract** | Keep Zod schemas simple; avoid deeply nested structures |
| **agent** | Set maxSteps based on task complexity (start at 20) |
| **pagination** | Explicitly teach agent pagination boundaries in system prompt |
| **models** | Llama-3.1 8B: fast but limited; GPT-4o mini: best for complex tasks |

---

## References

- **Official Docs:** https://docs.stagehand.dev
- **GitHub:** https://github.com/browserbase/stagehand
- **Browserbase:** https://www.browserbase.com

---

**Last Updated:** March 26, 2026  
**Source:** Context7 Documentation  
**Stagehand Version:** 3.0+
