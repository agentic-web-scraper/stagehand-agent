/**
 * Aria Tree (Accessibility Tree) Test
 * 
 * Tests the page.snapshot() method which captures the accessibility tree
 * of a web page, providing structured data about page elements.
 */

import { Stagehand } from "@browserbasehq/stagehand";
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Console colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testAriaTree() {
  log("\n" + "=".repeat(70), "cyan");
  log("🌳 TESTING ARIA TREE (Accessibility Tree Snapshot)", "bright");
  log("=".repeat(70), "cyan");
  
  let stagehand;
  
  try {
    // Initialize Stagehand
    log("\n⏳ Initializing Stagehand...", "yellow");
    stagehand = new Stagehand({
      env: "LOCAL",
      verbose: 1,
      headless: false,
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];
    log("✅ Stagehand initialized\n", "green");

    // Test URL - using a simple, well-structured page
    const testUrl = "https://example.com";
    log(`🌐 Navigating to: ${testUrl}`, "yellow");
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    log("✅ Page loaded\n", "green");

    // Capture accessibility tree snapshot
    log("📸 Capturing accessibility tree snapshot...", "yellow");
    const startTime = Date.now();
    
    const snapshot = await page.snapshot();
    
    const duration = Date.now() - startTime;
    log(`✅ Snapshot captured in ${duration}ms\n`, "green");

    // Display results
    log("╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ 📊 SNAPSHOT RESULTS                                            ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    // 1. Formatted Tree
    log("🌳 FORMATTED ACCESSIBILITY TREE:", "bright");
    log("─".repeat(70), "gray");
    console.log(snapshot.formattedTree);
    log("─".repeat(70) + "\n", "gray");

    // 2. XPath Map
    log("🗺️  XPATH MAP (Element ID → XPath):", "bright");
    log("─".repeat(70), "gray");
    const xpathEntries = Object.entries(snapshot.xpathMap);
    if (xpathEntries.length > 0) {
      xpathEntries.slice(0, 10).forEach(([id, xpath]) => {
        log(`  ${id} → ${xpath}`, "blue");
      });
      if (xpathEntries.length > 10) {
        log(`  ... and ${xpathEntries.length - 10} more`, "gray");
      }
    } else {
      log("  (empty)", "gray");
    }
    log("─".repeat(70) + "\n", "gray");

    // 3. URL Map
    log("🔗 URL MAP (Element ID → URL):", "bright");
    log("─".repeat(70), "gray");
    const urlEntries = Object.entries(snapshot.urlMap);
    if (urlEntries.length > 0) {
      urlEntries.forEach(([id, url]) => {
        log(`  ${id} → ${url}`, "blue");
      });
    } else {
      log("  (no links found)", "gray");
    }
    log("─".repeat(70) + "\n", "gray");

    // Statistics
    log("📈 STATISTICS:", "bright");
    log(`  • Total XPath mappings: ${xpathEntries.length}`, "blue");
    log(`  • Total URL mappings: ${urlEntries.length}`, "blue");
    log(`  • Tree size: ${snapshot.formattedTree.length} characters`, "blue");
    log(`  • Capture time: ${duration}ms\n`, "blue");

    // Save to file
    const outputFile = `results/aria_tree_snapshot_${Date.now()}.json`;
    const outputData = {
      timestamp: new Date().toISOString(),
      url: testUrl,
      captureTime: `${duration}ms`,
      statistics: {
        xpathMappings: xpathEntries.length,
        urlMappings: urlEntries.length,
        treeSize: snapshot.formattedTree.length,
      },
      snapshot: {
        formattedTree: snapshot.formattedTree,
        xpathMap: snapshot.xpathMap,
        urlMap: snapshot.urlMap,
      },
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    log(`💾 Full snapshot saved to: ${outputFile}`, "green");

    // Test 2: Snapshot without iframes
    log("\n" + "─".repeat(70), "gray");
    log("🔬 TEST 2: Snapshot without iframes", "bright");
    log("─".repeat(70), "gray");
    
    const snapshotNoIframes = await page.snapshot({ includeIframes: false });
    log(`✅ Snapshot captured (no iframes)`, "green");
    log(`  • Tree size: ${snapshotNoIframes.formattedTree.length} characters`, "blue");
    log(`  • XPath mappings: ${Object.keys(snapshotNoIframes.xpathMap).length}`, "blue");

    // Test 3: Navigate to a more complex page
    log("\n" + "─".repeat(70), "gray");
    log("🔬 TEST 3: Complex page (Hacker News)", "bright");
    log("─".repeat(70), "gray");
    
    await page.goto("https://news.ycombinator.com", { waitUntil: 'networkidle' });
    log("✅ Navigated to Hacker News", "green");
    
    const complexSnapshot = await page.snapshot();
    log(`✅ Complex snapshot captured`, "green");
    log(`  • Tree size: ${complexSnapshot.formattedTree.length} characters`, "blue");
    log(`  • XPath mappings: ${Object.keys(complexSnapshot.xpathMap).length}`, "blue");
    log(`  • URL mappings: ${Object.keys(complexSnapshot.urlMap).length}`, "blue");

    // Show sample of tree
    const treeLines = complexSnapshot.formattedTree.split('\n');
    log(`\n📄 First 20 lines of accessibility tree:`, "yellow");
    log("─".repeat(70), "gray");
    treeLines.slice(0, 20).forEach(line => {
      console.log(line);
    });
    if (treeLines.length > 20) {
      log(`... and ${treeLines.length - 20} more lines`, "gray");
    }
    log("─".repeat(70), "gray");

    // Save complex snapshot
    const complexOutputFile = `results/aria_tree_complex_${Date.now()}.json`;
    fs.writeFileSync(complexOutputFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      url: "https://news.ycombinator.com",
      statistics: {
        xpathMappings: Object.keys(complexSnapshot.xpathMap).length,
        urlMappings: Object.keys(complexSnapshot.urlMap).length,
        treeSize: complexSnapshot.formattedTree.length,
        treeLines: treeLines.length,
      },
      snapshot: {
        formattedTree: complexSnapshot.formattedTree,
        xpathMap: complexSnapshot.xpathMap,
        urlMap: complexSnapshot.urlMap,
      },
    }, null, 2));
    log(`\n💾 Complex snapshot saved to: ${complexOutputFile}`, "green");

    // Summary
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ ✅ ALL TESTS COMPLETED SUCCESSFULLY                            ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    log("📋 SUMMARY:", "bright");
    log("  ✅ Basic snapshot test (example.com)", "green");
    log("  ✅ Snapshot without iframes", "green");
    log("  ✅ Complex page snapshot (Hacker News)", "green");
    log("\n💡 USE CASES:", "yellow");
    log("  • Accessibility testing and validation", "blue");
    log("  • Element discovery without visual inspection", "blue");
    log("  • XPath generation for automation", "blue");
    log("  • Link extraction and mapping", "blue");
    log("  • Page structure analysis", "blue");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    console.error(error.stack);
  } finally {
    if (stagehand) {
      log("\n🔒 Closing Stagehand...", "yellow");
      await stagehand.close();
      log("✅ Done!\n", "green");
    }
  }
}

// Run test
testAriaTree().catch(console.error);
