'use strict';

import { Stagehand } from "@browserbasehq/stagehand";
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

// Rich console output
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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Test observe phase
async function testObservePhase() {
  console.clear();
  log("╔════════════════════════════════════════════════════════════════╗", "cyan");
  log("║   🧪 TEST OBSERVE PHASE: Selector Discovery & Validation      ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════╝", "cyan");
  
  let stagehand;
  
  try {
    // Get URL from user
    log("\n📝 Enter test details:", "bright");
    const url = await question("🌐 Website URL: ");
    
    if (!url) {
      log("\n❌ URL is required", "red");
      rl.close();
      return;
    }

    // Initialize Stagehand
    log("\n⏳ Initializing Stagehand with Chromium...", "yellow");
    stagehand = new Stagehand({
      env: "LOCAL",
      model: "azure/gpt-4o-mini",
      verbose: 0,
      headless: false,  // Show browser for testing
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];
    log("✅ Stagehand initialized\n", "green");

    // Navigate to page
    log(`⏳ Navigating to ${url}...`, "yellow");
    await page.goto(url, { waitUntil: 'networkidle' });
    log("✅ Page loaded\n", "green");

    // Interactive observe loop
    let continueObserving = true;
    const discoveredSelectors = {};
    
    while (continueObserving) {
      log("\n" + "=".repeat(70), "cyan");
      log("🔍 OBSERVE PHASE", "bright");
      log("=".repeat(70), "cyan");
      
      // Get observe prompt from user
      const observePrompt = await question("\n📝 What to observe (or 'done' to finish): ");
      
      if (observePrompt.toLowerCase() === 'done') {
        continueObserving = false;
        break;
      }
      
      if (!observePrompt) {
        log("⚠️  Prompt cannot be empty", "yellow");
        continue;
      }

      // Run observe
      log(`\n🧠 Agent observing: "${observePrompt}"`, "blue");
      const startTime = Date.now();
      
      try {
        const results = await stagehand.observe(observePrompt);
        const duration = Date.now() - startTime;
        
        if (!results || results.length === 0) {
          log(`❌ No elements found (${duration}ms)`, "red");
          continue;
        }
        
        log(`✅ Found ${results.length} element(s) in ${duration}ms\n`, "green");
        
        // Display results
        results.forEach((result, i) => {
          log(`📍 Result ${i + 1}:`, "bright");
          log(`   Selector: ${result.selector}`, "cyan");
          log(`   Description: ${result.description || 'N/A'}`, "gray");
          log(`   Method: ${result.method || 'N/A'}`, "gray");
          
          // Clean selector
          const cleanedSelector = result.selector.replace(/^xpath=/, '');
          discoveredSelectors[observePrompt] = cleanedSelector;
        });
        
        // Ask if user wants to validate
        const validate = await question("\n🔍 Validate this selector? (y/n): ");
        
        if (validate.toLowerCase() === 'y') {
          await validateSelector(page, results[0].selector, observePrompt);
        }
        
      } catch (error) {
        log(`❌ Error: ${error.message}`, "red");
      }
    }

    // Summary
    if (Object.keys(discoveredSelectors).length > 0) {
      log("\n" + "=".repeat(70), "cyan");
      log("📊 DISCOVERED SELECTORS SUMMARY", "bright");
      log("=".repeat(70), "cyan");
      
      Object.entries(discoveredSelectors).forEach(([prompt, selector]) => {
        log(`\n📝 Prompt: "${prompt}"`, "yellow");
        log(`   Selector: ${selector}`, "cyan");
      });
      
      // Ask if user wants to test extraction
      log("\n");
      const testExtraction = await question("🧪 Test data extraction with these selectors? (y/n): ");
      
      if (testExtraction.toLowerCase() === 'y') {
        await testDataExtraction(page, discoveredSelectors);
      }
    }

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    console.error(error.stack);
  } finally {
    if (stagehand) {
      log("\n🔌 Closing Stagehand...", "yellow");
      await stagehand.close();
      log("✅ Done!", "green");
    }
    rl.close();
  }
}

// Validate selector
async function validateSelector(page, selector, description) {
  log(`\n🔍 Validating selector...`, "yellow");
  
  try {
    const cleanedSelector = selector.replace(/^xpath=/, '');
    
    const count = await page.evaluate((sel) => {
      // Try to find elements using XPath or CSS
      const findElements = (selector) => {
        if (selector.startsWith('//')) {
          // XPath
          const result = document.evaluate(
            selector,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          return result.snapshotLength;
        } else {
          // CSS
          return document.querySelectorAll(selector).length;
        }
      };
      
      return findElements(sel);
    }, cleanedSelector);
    
    if (count > 0) {
      log(`✅ Valid! Found ${count} element(s)`, "green");
      
      // Get sample data
      const sampleData = await page.evaluate((sel) => {
        const findElements = (selector) => {
          if (selector.startsWith('//')) {
            const result = document.evaluate(
              selector,
              document,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null
            );
            const elements = [];
            for (let i = 0; i < Math.min(3, result.snapshotLength); i++) {
              elements.push(result.snapshotItem(i));
            }
            return elements;
          } else {
            return Array.from(document.querySelectorAll(selector)).slice(0, 3);
          }
        };
        
        const elements = findElements(sel);
        return elements.map(el => ({
          text: el.textContent?.trim().substring(0, 100) || 'N/A',
          tag: el.tagName,
          classes: el.className,
        }));
      }, cleanedSelector);
      
      log(`\n📊 Sample data (first 3):`, "blue");
      sampleData.forEach((item, i) => {
        log(`   ${i + 1}. [${item.tag}] ${item.text}`, "gray");
      });
      
    } else {
      log(`❌ Invalid! No elements found`, "red");
    }
    
  } catch (error) {
    log(`❌ Validation error: ${error.message}`, "red");
  }
}

// Test data extraction
async function testDataExtraction(page, selectors) {
  log("\n" + "=".repeat(70), "cyan");
  log("🧪 TESTING DATA EXTRACTION", "bright");
  log("=".repeat(70), "cyan");
  
  try {
    // Ask which selector to use as container
    log("\n📝 Available selectors:");
    const selectorKeys = Object.keys(selectors);
    selectorKeys.forEach((key, i) => {
      log(`   ${i + 1}. ${key}`, "cyan");
    });
    
    const containerIndex = await question("\n📦 Which selector is the item container? (number): ");
    const containerKey = selectorKeys[parseInt(containerIndex) - 1];
    
    if (!containerKey) {
      log("❌ Invalid selection", "red");
      return;
    }
    
    const containerSelector = selectors[containerKey];
    log(`\n📦 Using container: ${containerSelector}`, "blue");
    
    // Extract data
    log("\n⏳ Extracting data...", "yellow");
    const startTime = Date.now();
    
    const items = await page.evaluate((sel) => {
      const results = [];
      
      const findElements = (selector) => {
        if (selector.startsWith('//')) {
          const result = document.evaluate(
            selector,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          const elements = [];
          for (let i = 0; i < result.snapshotLength; i++) {
            elements.push(result.snapshotItem(i));
          }
          return elements;
        } else {
          return Array.from(document.querySelectorAll(selector));
        }
      };
      
      const containers = findElements(sel);
      
      containers.forEach((container) => {
        results.push({
          text: container.textContent?.trim() || 'N/A',
          html: container.innerHTML?.substring(0, 200) || 'N/A',
        });
      });
      
      return results;
    }, containerSelector);
    
    const duration = Date.now() - startTime;
    
    log(`✅ Extracted ${items.length} items in ${duration}ms\n`, "green");
    
    // Show sample
    log("📊 Sample items (first 5):", "bright");
    items.slice(0, 5).forEach((item, i) => {
      log(`   ${i + 1}. ${item.text.substring(0, 100)}...`, "blue");
    });
    
    if (items.length > 5) {
      log(`   ... and ${items.length - 5} more`, "gray");
    }
    
  } catch (error) {
    log(`❌ Extraction error: ${error.message}`, "red");
  }
}

// Run test
testObservePhase().catch(console.error);
