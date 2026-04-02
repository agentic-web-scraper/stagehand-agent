Implementation Plan: CSS Schema Generation (Crawl4AI Style)
Phase 1: Schema Generation Core
1. Update Schema Format

Add name field to schema (descriptive name like "Hacker News Posts")
Keep baseSelector (container element)
Enhance fields array with:
Support for html type (extract HTML blocks)
Support for regex type (extract with patterns)
Add default field (fallback value)
Add pattern field (for regex type)
Keep our pagination extension (not in Crawl4AI but useful)
2. Improve LLM Prompt

Create detailed prompt explaining schema format
Include examples of good schemas
Specify field types clearly (text, attribute, html, regex, number)
Add instructions for baseSelector selection
Emphasize relative selectors (relative to baseSelector)
Request JSON-only output (no markdown, no explanation)
3. HTML Preprocessing

Limit HTML to first 8KB (like Crawl4AI) - saves LLM costs
Clean HTML (remove scripts, styles, comments)
Optionally include aria tree for better structure understanding
Extract sample of repeating elements for pattern detection
Phase 2: Schema Validation & Refinement
4. Schema Validation

Parse LLM response and extract JSON
Validate schema structure:
Check required fields (name, baseSelector, fields)
Validate field types
Ensure selectors are valid CSS
Test schema against sample HTML:
Check if baseSelector finds elements
Check if field selectors work
Count how many items extracted
5. Schema Refinement (if validation fails)

If baseSelector finds 0 elements:
Ask LLM to suggest alternative selectors
Try common patterns (article, .post, .item, etc.)
If field selectors fail:
Ask LLM to refine specific fields
Provide feedback about what failed
Maximum 2-3 refinement attempts
Fall back to generic selectors if all fails
6. Schema Confidence Score

Calculate confidence based on:
Number of items found (more = better)
Percentage of fields successfully extracted
Selector specificity (class names > complex combinators)
Return confidence score with schema (0.0 to 1.0)
Phase 3: Caching System
7. File-Based Schema Cache

Create schema_cache/ directory
Save schemas as {domain}.json files
Include metadata:
Generated timestamp
URL used for generation
Confidence score
LLM model used
Query used
Check cache before generating new schema
Cache key: domain name (e.g., "news.ycombinator.com")
8. Cache Management

Function to list cached schemas
Function to clear cache (all or specific domain)
Function to reload schema from cache
Function to update schema (regenerate)
Cache expiration (optional, e.g., 30 days)
Phase 4: Enhanced Extraction
9. Multi-Type Field Extraction

text: Extract textContent and trim
attribute: Extract specified attribute (href, src, etc.)
html: Extract innerHTML
regex: Apply regex pattern to text
number: Extract numbers with parseInt/parseFloat
Apply transforms (trim, parseInt, parseFloat, custom)
Use default values if extraction fails
10. Nested Field Support (Advanced)

Support nested selectors for complex structures
Example: Extract product with nested reviews
Use dot notation for nested fields
Phase 5: Error Handling & Logging
11. Comprehensive Error Handling

Handle LLM API errors (timeout, rate limit, invalid response)
Handle invalid JSON from LLM
Handle invalid CSS selectors
Handle empty extraction results
Provide clear error messages
12. Verbose Logging

Log schema generation steps
Log validation results
Log extraction statistics
Log cache hits/misses
Color-coded console output
Phase 6: Testing & Optimization
13. Schema Testing

Test generated schema on multiple pages
Compare results across pages
Detect if schema works consistently
Suggest improvements if inconsistent
14. Performance Optimization

Minimize HTML sent to LLM (8KB max)
Cache schemas aggressively
Batch extraction for multiple pages
Reuse page.evaluate calls
File Structure
lib/
├── generateSchemaUtil.js (updated)
│   ├── generateCssSchema() - main generation function
│   ├── validateSchema() - validation logic
│   ├── refineSchema() - refinement logic
│   ├── extractWithSchema() - extraction logic
│   ├── getCachedSchema() - cache retrieval
│   ├── saveSchemaToCache() - cache saving
│   └── clearSchemaCache() - cache management
│
├── schemaValidator.js (new)
│   ├── validateSchemaStructure()
│   ├── testSchemaOnHTML()
│   ├── calculateConfidence()
│   └── suggestImprovements()
│
└── schemaCache.js (new)
    ├── loadFromCache()
    ├── saveToCache()
    ├── listCachedSchemas()
    ├── clearCache()
    └── getCacheStats()

schema_cache/ (new directory)
├── news.ycombinator.com.json
├── books.toscrape.com.json
└── example.com.json
Workflow Example
User: "Extract posts from Hacker News"

Step 1: Check Cache
→ Check schema_cache/news.ycombinator.com.json
→ Cache miss

Step 2: Prepare HTML
→ Load page
→ Extract first 8KB of cleaned HTML
→ Extract aria tree sample

Step 3: Build Prompt
→ Create detailed prompt with:
  - Schema format explanation
  - HTML sample
  - User query
  - Field type examples
  - Best practices

Step 4: Call LLM
→ Send to Azure OpenAI (gpt-4o-mini)
→ Parse JSON response
→ Extract schema object

Step 5: Validate Schema
→ Check structure (name, baseSelector, fields)
→ Test baseSelector on HTML
→ Test each field selector
→ Count extracted items
→ Calculate confidence score

Step 6: Refine (if needed)
→ If confidence < 0.7:
  - Identify failing selectors
  - Ask LLM to refine
  - Re-validate
  - Max 2 refinement attempts

Step 7: Cache Schema
→ Save to schema_cache/news.ycombinator.com.json
→ Include metadata (timestamp, confidence, etc.)

Step 8: Extract Data
→ Use schema to extract from current page
→ Return extracted items

Step 9: Reuse
→ Next time: Load from cache (no LLM call!)
→ Extract data instantly
Key Improvements Over Current Implementation
Validation: Test schema before returning
Refinement: Auto-fix failing schemas
Confidence: Know how reliable the schema is
File Cache: Persistent across runs
More Types: html, regex support
Better Prompts: More detailed instructions
Error Recovery: Graceful fallbacks
Metadata: Track schema provenance
Expected Results
Success Rate: 90%+ schemas work on first try
Confidence: Average 0.85+ confidence score
Cost: $0.001 per schema generation
Speed: <5 seconds to generate, <100ms to extract
Reusability: Schemas work across similar pages
Cache Hit Rate: 95%+ after initial generation