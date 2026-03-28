'use strict';

import { searchUrls, searchUrlsOnly, searchDetailed } from '../lib/searchUrls.js';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testSearchUrls() {
  console.clear();
  log("╔════════════════════════════════════════════════════════════════╗", "cyan");
  log("║   🔍 TEST: Search URLs Function                               ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

  try {
    // Test 1: Search with full details
    log("Test 1: Search with full details (title, url, snippet)", "bright");
    log("─".repeat(70), "gray");
    const result1 = await searchUrls("React documentation", 5);
    
    if (result1.success) {
      log(`✅ Found ${result1.count} results\n`, "green");
      result1.results.forEach((item, i) => {
        log(`${i + 1}. ${item.title}`, "blue");
        log(`   URL: ${item.url}`, "cyan");
        log(`   Snippet: ${item.snippet.substring(0, 80)}...\n`, "gray");
      });
    } else {
      log(`❌ Error: ${result1.error}`, "red");
    }

    // Test 2: Search URLs only
    log("\nTest 2: Search URLs only (simple list)", "bright");
    log("─".repeat(70), "gray");
    const result2 = await searchUrlsOnly("Python tutorials", 5);
    
    if (result2.success) {
      log(`✅ Found ${result2.count} URLs\n`, "green");
      result2.urls.forEach((url, i) => {
        log(`${i + 1}. ${url}`, "blue");
      });
    } else {
      log(`❌ Error: ${result2.error}`, "red");
    }

    // Test 3: Detailed search
    log("\nTest 3: Detailed search results", "bright");
    log("─".repeat(70), "gray");
    const result3 = await searchDetailed("JavaScript frameworks", 3);
    
    if (result3.success) {
      log(`✅ Found ${result3.count} results\n`, "green");
      log(JSON.stringify(result3.results, null, 2), "blue");
    } else {
      log(`❌ Error: ${result3.error}`, "red");
    }

    log("\n" + "=".repeat(70), "cyan");
    log("✅ All tests completed!", "green");
    log("=".repeat(70), "cyan");

  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, "red");
    console.error(error);
  }
}

// Run tests
testSearchUrls();
