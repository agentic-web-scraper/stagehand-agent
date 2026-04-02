# Webpage Schema Extraction Guide

**Complete guide to extracting webpage structure and schema using Stagehand**

Last Updated: April 1, 2026

---

## Overview

This guide covers all available methods in Stagehand for extracting webpage structure, schema, and content. Each method serves different use cases and provides different types of data.

## Available Methods

### 1. `page.snapshot()` - Accessibility Tree ⭐

**Best for:** Structured page analysis, XPath generation, automation scripts

**What it returns:**
- `formattedTree`: Human-readable accessibility tree
- `xpathMap`: Element ID → XPath mappings
- `urlMap`: Element ID → URL mappings

**Example:**
```javascript
const page = stagehand.context.pages()[0];
await page.goto("https://example.com");

const { formattedTree, xpathMap, urlMap } = await page.snapshot();

// Print the accessibility tree
console.log(formattedTree);
// Output:
// [0-2] RootWebArea: Example Domain
//   [0-4] scrollable, html
//     [0-12] div
//       [0-13] heading: Example Domain
//       [0-15] paragraph
//         [0-16] StaticText: This domain is for use...
//       [0-17] paragraph
//         [0-18] link: Learn more

// Look up element's XPath by ID
console.log(xpathMap["0-18"]); 
// Output: "/html[1]/body[1]/div[1]/p[2]/a[1]"

// Get link URL
console.log(urlMap["0-18"]); 
// Output: "https://iana.org/domains/example"

// Exclude iframe content
const mainDocOnly = await page.snapshot({ includeIframes: false });
```

**Performance:**
- Time: ~20ms (simple page)
- Time: ~30ms (complex page like Hacker News)

**Use cases:**
- ✅ Understanding page hierarchy and structure
- ✅ Generating XPath selectors for automation
- ✅ Accessibility testing and validation
- ✅ Element discovery without visual inspection
- ✅ Link extraction and mapping

---

### 2. `stagehand.extract()` - Readable Text Content

**Best for:** Text extraction, AI-powered data extraction with schemas

**What it returns:**
- `pageText`: Clean, readable text content (no params)
- Structured data matching Zod schema (with schema)

**Example:**
```javascript
// Extract raw page text
const pageContent = await stagehand.extract();
console.log(pageContent.pageText);
// Output: Clean text without HTML tags

// Extract with natural language
const simpleExtract = await stagehand.extract("extract the page title");
console.log(simpleExtract.extraction);

// Extract structured data with Zod schema
import { z } from "zod";

const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  inStock: z.boolean()
});

const product = await stagehand.extract(
  "extract product details", 
  ProductSchema
);
// Output: { name: "...", price: 99.99, inStock: true }

// Targeted extraction with selector
const targetedData = await stagehand.extract(
  "extract the content",
  z.string(),
  { selector: "/html/body/div[1]/p" }
);
```

**Performance:**
- Time: ~10-15ms (simple extraction)
- Time: ~500-2000ms (AI-powered extraction with schema)

**Use cases:**
- ✅ Extracting readable text without HTML
- ✅ AI-powered data extraction with natural language
- ✅ Structured data extraction with type safety (Zod)
- ✅ Targeted extraction from specific elements
- ✅ Content analysis and processing

---

### 3. `page.evaluate(() => document.documentElement.outerHTML)` - Raw HTML ⚡

**Best for:** Getting complete HTML source code

**What it returns:**
- Complete HTML source as string

**Example:**
```javascript
const htmlContent = await page.evaluate(() => document.documentElement.outerHTML);

console.log(htmlContent);
// Output: 
// <html lang="en"><head><title>Example Domain</title>...

// Save to file
import fs from 'fs';
fs.writeFileSync('page.html', htmlContent);

// Parse with custom logic
const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
console.log(titleMatch[1]); // "Example Domain"
```

**Performance:**
- Time: ~3-5ms (fastest method)

**Use cases:**
- ✅ Saving complete page source
- ✅ Manual HTML parsing
- ✅ Debugging page structure
- ✅ Archiving web pages
- ✅ Custom HTML analysis

---

### 4. `page.evaluate(customFunction)` - Custom DOM Analysis 🔬

**Best for:** Custom analysis, computed values, full control

**What it returns:**
- Any data structure you define in your custom function

**Example:**
```javascript
const domAnalysis = await page.evaluate(() => {
  return {
    title: document.title,
    url: window.location.href,
    
    // Count all elements
    totalElements: document.querySelectorAll('*').length,
    
    // Extract all links
    links: Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent?.trim(),
      href: a.href,
    })),
    
    // Extract all headings
    headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
      level: h.tagName.toLowerCase(),
      text: h.textContent?.trim(),
    })),
    
    // Extract all images
    images: Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      alt: img.alt,
    })),
    
    // Extract all forms
    forms: Array.from(document.querySelectorAll('form')).map(form => ({
      action: form.action,
      method: form.method,
      inputs: Array.from(form.querySelectorAll('input')).map(input => ({
        type: input.type,
        name: input.name,
      })),
    })),
    
    // Extract meta tags
    meta: Array.from(document.querySelectorAll('meta')).map(meta => ({
      name: meta.name || meta.getAttribute('property'),
      content: meta.content,
    })),
    
    // Get computed styles
    bodyStyles: window.getComputedStyle(document.body),
    
    // Get viewport dimensions
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
});

console.log(domAnalysis);
// Output: Complete custom analysis object
```

**Performance:**
- Time: ~5-10ms (depends on complexity)

**Use cases:**
- ✅ Custom DOM traversal and analysis
- ✅ Extracting computed CSS values
- ✅ Getting viewport and scroll information
- ✅ Analyzing page performance metrics
- ✅ Building custom page schemas
- ✅ Full control over data extraction logic

---

## Performance Comparison

Based on testing with example.com:

| Method | Time (ms) | Data Type | Size |
|--------|-----------|-----------|------|
| `page.snapshot()` | 21 | Accessibility tree | 317 chars, 18 elements |
| `stagehand.extract()` | 14 | Readable text | 317 chars |
| `evaluate(HTML)` | 3 | Raw HTML | 513 chars, 21 tags |
| `evaluate(DOM)` | 6 | Custom object | 10 elements analyzed |

**Winner by speed:** `page.evaluate(() => document.outerHTML)` (3ms) ⚡

**Winner by structure:** `page.snapshot()` (most comprehensive) ⭐

---

## Method Selection Guide

### Choose `page.snapshot()` when:
- ✅ You need structured accessibility tree
- ✅ You want XPath mappings for elements
- ✅ You need to understand page hierarchy
- ✅ You're building automation scripts
- ✅ You need accessibility testing

### Choose `stagehand.extract()` when:
- ✅ You need readable text content
- ✅ You want to extract specific data with AI
- ✅ You need structured data with Zod schemas
- ✅ You want natural language extraction
- ✅ You need type-safe data extraction

### Choose `page.evaluate(() => document.outerHTML)` when:
- ✅ You need raw HTML source code
- ✅ You want to parse HTML manually
- ✅ You need to save complete page source
- ✅ Speed is critical (fastest method)
- ✅ You need the complete DOM structure

### Choose `page.evaluate(customFunction)` when:
- ✅ You need custom DOM analysis
- ✅ You want to run JavaScript in page context
- ✅ You need specific computed values
- ✅ You want full control over data extraction
- ✅ You need to analyze page performance
- ✅ You need viewport or scroll information

---

## Real-World Examples

### Example 1: E-commerce Product Scraping

```javascript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

const stagehand = new Stagehand({ env: "LOCAL" });
await stagehand.init();
const page = stagehand.context.pages()[0];

await page.goto("https://example-shop.com/product");

// Method 1: Get page structure first
const { formattedTree, xpathMap } = await page.snapshot();
console.log("Page structure:", formattedTree);

// Method 2: Extract structured product data
const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  rating: z.number(),
  inStock: z.boolean(),
  images: z.array(z.string().url()),
});

const product = await stagehand.extract(
  "extract product details",
  ProductSchema
);

console.log(product);
// { name: "...", price: 99.99, rating: 4.5, inStock: true, images: [...] }

await stagehand.close();
```

### Example 2: News Article Extraction

```javascript
const stagehand = new Stagehand({ env: "LOCAL" });
await stagehand.init();
const page = stagehand.context.pages()[0];

await page.goto("https://news.example.com");

// Get all article links using custom DOM analysis
const articles = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('article')).map(article => ({
    title: article.querySelector('h2')?.textContent?.trim(),
    link: article.querySelector('a')?.href,
    summary: article.querySelector('.summary')?.textContent?.trim(),
    author: article.querySelector('.author')?.textContent?.trim(),
    date: article.querySelector('time')?.getAttribute('datetime'),
  }));
});

console.log(`Found ${articles.length} articles`);
console.log(articles);

await stagehand.close();
```

### Example 3: Form Analysis

```javascript
const stagehand = new Stagehand({ env: "LOCAL" });
await stagehand.init();
const page = stagehand.context.pages()[0];

await page.goto("https://example.com/contact");

// Analyze form structure
const formAnalysis = await page.evaluate(() => {
  const forms = Array.from(document.querySelectorAll('form'));
  
  return forms.map(form => ({
    action: form.action,
    method: form.method,
    fields: Array.from(form.querySelectorAll('input, textarea, select')).map(field => ({
      type: field.type || field.tagName.toLowerCase(),
      name: field.name,
      id: field.id,
      required: field.required,
      placeholder: field.placeholder,
      label: form.querySelector(`label[for="${field.id}"]`)?.textContent?.trim(),
    })),
    buttons: Array.from(form.querySelectorAll('button, input[type="submit"]')).map(btn => ({
      type: btn.type,
      text: btn.textContent?.trim() || btn.value,
    })),
  }));
});

console.log("Form structure:", JSON.stringify(formAnalysis, null, 2));

await stagehand.close();
```

---

## Testing

A comprehensive test file is available at `tests/webpage_schema_test.js` that demonstrates all four methods.

**Run the test:**
```bash
node tests/webpage_schema_test.js
```

**Test output includes:**
- Accessibility tree structure
- Raw page text
- Complete HTML source
- Custom DOM analysis
- Performance comparison
- Method recommendations

**Results saved to:**
- `results/webpage_schema_comparison_[timestamp].json`

---

## Tips & Best Practices

### 1. Combine Methods for Best Results

```javascript
// Step 1: Get structure with snapshot
const { formattedTree, xpathMap } = await page.snapshot();

// Step 2: Extract specific data with AI
const data = await stagehand.extract("extract product info", ProductSchema);

// Step 3: Get additional details with custom evaluation
const metadata = await page.evaluate(() => ({
  viewport: { width: window.innerWidth, height: window.innerHeight },
  scrollHeight: document.documentElement.scrollHeight,
}));
```

### 2. Use Schemas for Type Safety

```javascript
import { z } from "zod";

// Define strict schema
const ArticleSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  author: z.string(),
  publishDate: z.string().datetime(),
  content: z.string().min(100),
});

// Extract with validation
const article = await stagehand.extract("extract article", ArticleSchema);
// TypeScript knows the exact shape of 'article'
```

### 3. Handle Errors Gracefully

```javascript
try {
  const snapshot = await page.snapshot();
  console.log("Snapshot captured:", snapshot.formattedTree);
} catch (error) {
  console.error("Snapshot failed:", error.message);
  
  // Fallback to HTML extraction
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  console.log("Fallback HTML:", html.substring(0, 200));
}
```

### 4. Optimize for Performance

```javascript
// For large pages, exclude iframes
const snapshot = await page.snapshot({ includeIframes: false });

// For repeated extractions, cache the snapshot
const cachedSnapshot = await page.snapshot();
// Use cachedSnapshot.xpathMap for multiple lookups

// For simple data, use evaluate (fastest)
const title = await page.evaluate(() => document.title);
```

---

## Common Issues & Solutions

### Issue 1: `page.content()` is not available

**Solution:** Use `page.evaluate()` instead:
```javascript
const html = await page.evaluate(() => document.documentElement.outerHTML);
```

### Issue 2: Snapshot returns empty tree

**Cause:** Page not fully loaded

**Solution:** Wait for page load:
```javascript
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForLoadState('domcontentloaded');
const snapshot = await page.snapshot();
```

### Issue 3: Extract returns incorrect data

**Cause:** Schema too complex or page structure unclear

**Solution:** Simplify schema or use observe first:
```javascript
// First, observe to understand structure
const elements = await stagehand.observe("find all products");
console.log(elements);

// Then extract with clearer instructions
const products = await stagehand.extract(
  "extract name and price from each product card",
  ProductSchema
);
```

### Issue 4: Evaluate returns serialization error

**Cause:** Trying to return non-serializable objects (DOM nodes, functions)

**Solution:** Return plain objects only:
```javascript
// ❌ Wrong - returns DOM node
const element = await page.evaluate(() => document.querySelector('h1'));

// ✅ Correct - returns plain data
const heading = await page.evaluate(() => ({
  text: document.querySelector('h1')?.textContent,
  tag: document.querySelector('h1')?.tagName,
}));
```

---

## Related Documentation

- [Stagehand Architecture Deep Dive](./STAGEHAND_ARCHITECTURE_DEEP_DIVE.md)
- [Stagehand Tools and Modes](./STAGEHAND_TOOLS_AND_MODES.md)
- [Project Overview](./PROJECT_OVERVIEW.md)

---

## Summary

**For webpage schema extraction, the recommended approach is:**

1. **Start with `page.snapshot()`** to understand page structure
2. **Use `stagehand.extract()` with schemas** for structured data extraction
3. **Use `page.evaluate()`** for custom analysis or raw HTML
4. **Combine methods** for comprehensive data extraction

Each method has its strengths - choose based on your specific needs for speed, structure, or flexibility.

---

**Last Updated:** April 1, 2026  
**Stagehand Version:** 3.0+  
**Test File:** `tests/webpage_schema_test.js`
