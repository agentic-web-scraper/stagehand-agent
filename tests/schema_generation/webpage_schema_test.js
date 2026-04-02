/**
 * Webpage Schema Extraction Test
 * 
 * Tests different methods to get webpage structure/schema:
 * 1. page.snapshot() - Accessibility tree (structured)
 * 2. stagehand.extract() - Raw page content
 * 3. page.content() - Raw HTML source
 * 4. page.evaluate() - Custom DOM analysis
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
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
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testWebpageSchema() {
  log("\n" + "=".repeat(70), "cyan");
  log("📋 TESTING WEBPAGE SCHEMA EXTRACTION METHODS", "bright");
  log("=".repeat(70), "cyan");
  
  let stagehand;
  
  try {
    // Initialize Stagehand
    log("\n⏳ Initializing Stagehand...", "yellow");
    stagehand = new Stagehand({
      env: "LOCAL",
      verbose: 0,
      headless: false,
      experimental: true,
      disableAPI: true,
    });

    await stagehand.init();
    const page = stagehand.context.pages()[0];
    log("✅ Stagehand initialized\n", "green");

    // Test URL - using a simple, well-structured page
    const testUrl = "https://example.com";
    log(`🌐 Navigating to: ${testUrl}`, "yellow");
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    log("✅ Page loaded\n", "green");

    const results = {};

    // ========================================================================
    // METHOD 1: page.snapshot() - Accessibility Tree (Best for Structure)
    // ========================================================================
    log("╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ METHOD 1: page.snapshot() - Accessibility Tree                ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    log("📸 Capturing accessibility tree...", "yellow");
    const startSnapshot = Date.now();
    const snapshot = await page.snapshot();
    const snapshotTime = Date.now() - startSnapshot;
    
    log(`✅ Snapshot captured in ${snapshotTime}ms\n`, "green");
    log("🌳 Accessibility Tree Structure:", "bright");
    log("─".repeat(70), "gray");
    console.log(snapshot.formattedTree);
    log("─".repeat(70), "gray");
    
    log(`\n📊 Statistics:`, "blue");
    log(`  • Elements mapped: ${Object.keys(snapshot.xpathMap).length}`, "blue");
    log(`  • Links found: ${Object.keys(snapshot.urlMap).length}`, "blue");
    log(`  • Tree size: ${snapshot.formattedTree.length} characters`, "blue");
    
    results.snapshot = {
      method: "page.snapshot()",
      captureTime: `${snapshotTime}ms`,
      elementsCount: Object.keys(snapshot.xpathMap).length,
      linksCount: Object.keys(snapshot.urlMap).length,
      treeSize: snapshot.formattedTree.length,
      data: snapshot,
    };

    // ========================================================================
    // METHOD 2: stagehand.extract() - Raw Page Content
    // ========================================================================
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ METHOD 2: stagehand.extract() - Raw Page Content              ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    log("📄 Extracting raw page content...", "yellow");
    const startExtract = Date.now();
    const pageContent = await stagehand.extract();
    const extractTime = Date.now() - startExtract;
    
    log(`✅ Content extracted in ${extractTime}ms\n`, "green");
    log("📝 Raw Page Text:", "bright");
    log("─".repeat(70), "gray");
    const contentPreview = pageContent.pageText.substring(0, 500);
    console.log(contentPreview);
    if (pageContent.pageText.length > 500) {
      log(`\n... (${pageContent.pageText.length - 500} more characters)`, "gray");
    }
    log("─".repeat(70), "gray");
    
    log(`\n📊 Statistics:`, "blue");
    log(`  • Total characters: ${pageContent.pageText.length}`, "blue");
    log(`  • Word count: ~${pageContent.pageText.split(/\s+/).length}`, "blue");
    
    results.extract = {
      method: "stagehand.extract()",
      captureTime: `${extractTime}ms`,
      totalCharacters: pageContent.pageText.length,
      wordCount: pageContent.pageText.split(/\s+/).length,
      preview: contentPreview,
    };

    // ========================================================================
    // METHOD 3: page.evaluate() - Get HTML via JavaScript
    // ========================================================================
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ METHOD 3: page.evaluate() - Get HTML via JavaScript           ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    log("🔍 Getting raw HTML source via evaluate...", "yellow");
    const startContent = Date.now();
    const htmlContent = await page.evaluate(() => document.documentElement.outerHTML);
    const contentTime = Date.now() - startContent;
    
    log(`✅ HTML retrieved in ${contentTime}ms\n`, "green");
    log("📝 HTML Source:", "bright");
    log("─".repeat(70), "gray");
    const htmlPreview = htmlContent.substring(0, 500);
    console.log(htmlPreview);
    if (htmlContent.length > 500) {
      log(`\n... (${htmlContent.length - 500} more characters)`, "gray");
    }
    log("─".repeat(70), "gray");
    
    log(`\n📊 Statistics:`, "blue");
    log(`  • Total characters: ${htmlContent.length}`, "blue");
    log(`  • HTML tags: ~${(htmlContent.match(/<[^>]+>/g) || []).length}`, "blue");
    
    results.htmlSource = {
      method: "page.evaluate(() => document.documentElement.outerHTML)",
      captureTime: `${contentTime}ms`,
      totalCharacters: htmlContent.length,
      htmlTagsCount: (htmlContent.match(/<[^>]+>/g) || []).length,
      preview: htmlPreview,
    };

    // ========================================================================
    // METHOD 4: page.evaluate() - Custom DOM Analysis
    // ========================================================================
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ METHOD 4: page.evaluate() - Custom DOM Analysis               ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    log("🔬 Running custom DOM analysis...", "yellow");
    const startEvaluate = Date.now();
    const domAnalysis = await page.evaluate(() => {
      // Custom JavaScript to analyze DOM structure
      const getAllElements = (node, depth = 0, maxDepth = 10) => {
        if (depth > maxDepth) return [];
        
        const elements = [];
        const tagName = node.tagName?.toLowerCase() || 'text';
        
        elements.push({
          tag: tagName,
          depth: depth,
          id: node.id || null,
          classes: node.className ? node.className.split(' ').filter(c => c) : [],
          text: node.nodeType === Node.TEXT_NODE ? node.textContent?.trim() : null,
          attributes: node.attributes ? Array.from(node.attributes).map(attr => ({
            name: attr.name,
            value: attr.value
          })) : [],
        });
        
        if (node.childNodes) {
          for (const child of node.childNodes) {
            elements.push(...getAllElements(child, depth + 1, maxDepth));
          }
        }
        
        return elements;
      };
      
      const body = document.body;
      const allElements = getAllElements(body);
      
      // Count elements by tag
      const tagCounts = {};
      allElements.forEach(el => {
        if (el.tag) {
          tagCounts[el.tag] = (tagCounts[el.tag] || 0) + 1;
        }
      });
      
      return {
        title: document.title,
        url: window.location.href,
        totalElements: allElements.length,
        tagCounts: tagCounts,
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim(),
          href: a.href,
        })),
        headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          level: h.tagName.toLowerCase(),
          text: h.textContent?.trim(),
        })),
        images: Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt,
        })),
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          action: form.action,
          method: form.method,
          inputs: Array.from(form.querySelectorAll('input')).map(input => ({
            type: input.type,
            name: input.name,
          })),
        })),
        meta: Array.from(document.querySelectorAll('meta')).map(meta => ({
          name: meta.name || meta.getAttribute('property'),
          content: meta.content,
        })),
      };
    });
    const evaluateTime = Date.now() - startEvaluate;
    
    log(`✅ DOM analysis completed in ${evaluateTime}ms\n`, "green");
    
    log("📊 DOM Structure Analysis:", "bright");
    log("─".repeat(70), "gray");
    log(`  Title: ${domAnalysis.title}`, "blue");
    log(`  URL: ${domAnalysis.url}`, "blue");
    log(`  Total Elements: ${domAnalysis.totalElements}`, "blue");
    log(`\n  Element Counts by Tag:`, "magenta");
    Object.entries(domAnalysis.tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([tag, count]) => {
        log(`    ${tag}: ${count}`, "blue");
      });
    
    log(`\n  Links: ${domAnalysis.links.length}`, "magenta");
    domAnalysis.links.forEach((link, i) => {
      log(`    ${i + 1}. ${link.text} → ${link.href}`, "blue");
    });
    
    log(`\n  Headings: ${domAnalysis.headings.length}`, "magenta");
    domAnalysis.headings.forEach((heading, i) => {
      log(`    ${i + 1}. <${heading.level}> ${heading.text}`, "blue");
    });
    
    log(`\n  Images: ${domAnalysis.images.length}`, "magenta");
    domAnalysis.images.forEach((img, i) => {
      log(`    ${i + 1}. ${img.alt || '(no alt)'} → ${img.src}`, "blue");
    });
    
    log(`\n  Forms: ${domAnalysis.forms.length}`, "magenta");
    
    log(`\n  Meta Tags: ${domAnalysis.meta.length}`, "magenta");
    domAnalysis.meta.slice(0, 5).forEach((meta, i) => {
      log(`    ${i + 1}. ${meta.name}: ${meta.content}`, "blue");
    });
    log("─".repeat(70), "gray");
    
    results.evaluate = {
      method: "page.evaluate()",
      captureTime: `${evaluateTime}ms`,
      domAnalysis: domAnalysis,
    };

    // ========================================================================
    // COMPARISON TABLE
    // ========================================================================
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ 📊 METHOD COMPARISON                                           ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    log("┌────────────────────────┬──────────────┬─────────────────────────┐", "gray");
    log("│ Method                 │ Time         │ Best For                │", "gray");
    log("├────────────────────────┼──────────────┼─────────────────────────┤", "gray");
    log(`│ page.snapshot()        │ ${snapshotTime.toString().padEnd(12)} │ Structure & XPaths      │`, "blue");
    log(`│ stagehand.extract()    │ ${extractTime.toString().padEnd(12)} │ Readable text content   │`, "blue");
    log(`│ evaluate(HTML)         │ ${contentTime.toString().padEnd(12)} │ Raw HTML source         │`, "blue");
    log(`│ evaluate(DOM)          │ ${evaluateTime.toString().padEnd(12)} │ Custom DOM analysis     │`, "blue");
    log("└────────────────────────┴──────────────┴─────────────────────────┘", "gray");

    // Save results
    const outputFile = `results/webpage_schema_comparison_${Date.now()}.json`;
    const outputData = {
      timestamp: new Date().toISOString(),
      url: testUrl,
      methods: results,
      comparison: {
        fastest: Object.entries(results).sort((a, b) => 
          parseInt(a[1].captureTime) - parseInt(b[1].captureTime)
        )[0][0],
        recommendations: {
          "Structure & Accessibility": "page.snapshot()",
          "Readable Text": "stagehand.extract()",
          "Raw HTML": "page.evaluate(() => document.documentElement.outerHTML)",
          "Custom Analysis": "page.evaluate(customFunction)",
        }
      }
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    log(`\n💾 Full results saved to: ${outputFile}`, "green");

    // ========================================================================
    // RECOMMENDATIONS
    // ========================================================================
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ 💡 RECOMMENDATIONS                                             ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    log("Use page.snapshot() when:", "bright");
    log("  ✓ You need structured accessibility tree", "green");
    log("  ✓ You want XPath mappings for elements", "green");
    log("  ✓ You need to understand page hierarchy", "green");
    log("  ✓ You're building automation scripts", "green");
    
    log("\nUse stagehand.extract() when:", "bright");
    log("  ✓ You need readable text content", "green");
    log("  ✓ You want to extract specific data with AI", "green");
    log("  ✓ You need structured data with Zod schemas", "green");
    
    log("\nUse page.evaluate(() => document.outerHTML) when:", "bright");
    log("  ✓ You need raw HTML source code", "green");
    log("  ✓ You want to parse HTML manually", "green");
    log("  ✓ You need to save complete page source", "green");
    
    log("\nUse page.evaluate(customFunction) when:", "bright");
    log("  ✓ You need custom DOM analysis", "green");
    log("  ✓ You want to run JavaScript in page context", "green");
    log("  ✓ You need specific computed values", "green");
    log("  ✓ You want full control over data extraction", "green");

    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ ✅ ALL TESTS COMPLETED SUCCESSFULLY                            ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    console.error(error.stack);
  } finally {
    if (stagehand) {
      log("🔒 Closing Stagehand...", "yellow");
      await stagehand.close();
      log("✅ Done!\n", "green");
    }
  }
}

// Run test
testWebpageSchema().catch(console.error);
