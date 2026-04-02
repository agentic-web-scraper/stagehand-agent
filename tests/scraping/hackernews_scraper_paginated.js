/**
 * Hacker News Scraper with Pagination
 * 
 * Uses schema to identify patterns, then uses CSS selectors for pagination
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function scrapeHackerNewsPaginated() {
  log("\n" + "=".repeat(70), "cyan");
  log("📰 HACKER NEWS SCRAPER WITH PAGINATION", "bright");
  log("=".repeat(70), "cyan");
  
  let stagehand;
  
  try {
    const url = "https://news.ycombinator.com";
    const totalPosts = parseInt(process.argv[2]) || 60;
    const postsPerPage = 30; // HN shows 30 posts per page
    const pagesToScrape = Math.ceil(totalPosts / postsPerPage);
    
    log(`\n🌐 URL: ${url}`, "yellow");
    log(`📊 Target posts: ${totalPosts}`, "yellow");
    log(`📄 Pages to scrape: ${pagesToScrape}`, "yellow");
    log("⏳ Initializing Stagehand...\n", "yellow");
    
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

    // Step 1: Get schema from first page to understand structure
    log("📸 Step 1: Analyzing first page schema...", "bright");
    await page.goto(url, { waitUntil: 'networkidle' });
    const snapshot = await page.snapshot();
    log(`✅ Schema captured: ${Object.keys(snapshot.xpathMap).length} elements\n`, "green");

    // Step 2: Identify pagination link from schema
    log("🔍 Step 2: Identifying pagination pattern from schema...", "bright");
    let paginationUrl = null;
    
    Object.entries(snapshot.urlMap).forEach(([id, url]) => {
      if (url.includes('?p=')) {
        paginationUrl = url;
        log(`✅ Found pagination URL: ${url}`, "green");
      }
    });
    
    // Also check the tree for "More" link
    const treeLines = snapshot.formattedTree.split('\n');
    treeLines.forEach(line => {
      if (line.includes('More') || line.includes('more')) {
        log(`✅ Found "More" link in tree`, "green");
      }
    });
    log("", "reset");

    // Step 3: Extract posts from multiple pages
    log("📊 Step 3: Scraping posts across multiple pages...", "bright");
    
    const allPosts = [];
    
    for (let pageNum = 1; pageNum <= pagesToScrape; pageNum++) {
      log(`\n📄 Scraping page ${pageNum}/${pagesToScrape}...`, "yellow");
      
      // Navigate to page (first page already loaded)
      if (pageNum > 1) {
        const pageUrl = `${url}?p=${pageNum}`;
        log(`   🌐 Navigating to: ${pageUrl}`, "blue");
        await page.goto(pageUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000); // Small delay
      }
      
      // Extract posts using CSS selectors (work across all pages)
      const posts = await page.evaluate(() => {
        const posts = [];
        const storyRows = document.querySelectorAll('tr.athing');
        
        for (let i = 0; i < storyRows.length; i++) {
          const storyRow = storyRows[i];
          const metaRow = storyRow.nextElementSibling;
          
          if (!metaRow) continue;
          
          // Extract rank
          const rankEl = storyRow.querySelector('.rank');
          const rank = rankEl ? parseInt(rankEl.textContent) : i + 1;
          
          // Extract title and URL
          const titleLink = storyRow.querySelector('.titleline > a');
          const title = titleLink ? titleLink.textContent.trim() : '';
          const url = titleLink ? titleLink.href : '';
          
          // Extract points
          const scoreEl = metaRow.querySelector('.score');
          const points = scoreEl ? parseInt(scoreEl.textContent) : 0;
          
          // Extract author
          const authorEl = metaRow.querySelector('.hnuser');
          const author = authorEl ? authorEl.textContent : '';
          
          // Extract time
          const timeEl = metaRow.querySelector('.age');
          const time = timeEl ? timeEl.textContent.trim() : '';
          
          // Extract comments
          const commentsEl = metaRow.querySelectorAll('a');
          let comments = 0;
          let commentsUrl = '';
          
          for (const link of commentsEl) {
            if (link.textContent.includes('comment')) {
              const match = link.textContent.match(/(\d+)\s+comment/);
              comments = match ? parseInt(match[1]) : 0;
              commentsUrl = link.href;
              break;
            } else if (link.textContent === 'discuss') {
              commentsUrl = link.href;
              break;
            }
          }
          
          posts.push({
            rank,
            title,
            url: url || commentsUrl,
            points,
            author,
            time,
            comments,
            commentsUrl,
          });
        }
        
        return posts;
      });
      
      log(`   ✅ Extracted ${posts.length} posts from page ${pageNum}`, "green");
      allPosts.push(...posts);
      
      // Stop if we have enough posts
      if (allPosts.length >= totalPosts) {
        log(`   ℹ️  Reached target of ${totalPosts} posts`, "blue");
        break;
      }
    }
    
    // Trim to exact number requested
    const finalPosts = allPosts.slice(0, totalPosts);
    
    log(`\n✅ Total posts extracted: ${finalPosts.length}\n`, "green");

    // Display results
    log("╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ 📰 HACKER NEWS POSTS (PAGINATED)                               ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    finalPosts.forEach((post, i) => {
      log(`${post.rank}. ${post.title}`, "bright");
      log(`   🔗 ${post.url.substring(0, 80)}${post.url.length > 80 ? '...' : ''}`, "blue");
      if (post.points) log(`   ⬆️  ${post.points} points`, "green");
      if (post.author) log(`   👤 by ${post.author}`, "magenta");
      log(`   ⏰ ${post.time}`, "yellow");
      log(`   💬 ${post.comments} comments`, "cyan");
      
      // Add separator every 30 posts (page boundary)
      if ((i + 1) % 30 === 0 && i + 1 < finalPosts.length) {
        log(`\n   ${"─".repeat(60)} PAGE ${Math.floor(i / 30) + 1} END ${"─".repeat(60)}\n`, "gray");
      } else {
        log("", "reset");
      }
    });

    // Save results
    const outputFile = `results/hackernews_paginated_${Date.now()}.json`;
    const outputData = {
      timestamp: new Date().toISOString(),
      url: url,
      method: "Schema-based pagination with CSS selectors",
      totalPosts: finalPosts.length,
      pagesScraped: pagesToScrape,
      posts: finalPosts,
      schema: {
        totalElements: Object.keys(snapshot.xpathMap).length,
        totalLinks: Object.keys(snapshot.urlMap).length,
        paginationUrlFound: paginationUrl,
      },
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    log(`💾 Results saved to: ${outputFile}`, "green");

    // Statistics
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ 📊 STATISTICS                                                  ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    const totalPoints = finalPosts.reduce((sum, p) => sum + (p.points || 0), 0);
    const totalComments = finalPosts.reduce((sum, p) => sum + p.comments, 0);
    const avgPoints = totalPoints / finalPosts.filter(p => p.points).length;
    const avgComments = totalComments / finalPosts.length;
    
    log(`📊 Total posts scraped: ${finalPosts.length}`, "blue");
    log(`📄 Pages scraped: ${pagesToScrape}`, "blue");
    log(`⬆️  Total points: ${totalPoints}`, "green");
    log(`💬 Total comments: ${totalComments}`, "cyan");
    log(`📈 Average points: ${avgPoints.toFixed(1)}`, "green");
    log(`📈 Average comments: ${avgComments.toFixed(1)}`, "cyan");
    log(`🏆 Top post: "${finalPosts[0]?.title}" (${finalPosts[0]?.points} points)`, "yellow");

    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ ✅ SCRAPING COMPLETE                                           ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    log("💡 How Schema Helped with Pagination:", "yellow");
    log("  ✓ Step 1: Used page.snapshot() to understand page structure", "green");
    log("  ✓ Step 2: Identified pagination URL pattern (?p=2, ?p=3, etc.)", "green");
    log("  ✓ Step 3: Found CSS class patterns (.athing, .titleline, etc.)", "green");
    log("  ✓ Step 4: Used CSS selectors (work across all pages)", "green");
    log("  ✓ Result: Scraped multiple pages successfully!", "green");
    
    log("\n💡 Key Insight:", "yellow");
    log("  • XPath from schema is page-specific (absolute paths)", "blue");
    log("  • CSS selectors from schema work across pages (class-based)", "blue");
    log("  • Use schema to discover patterns, then use CSS for pagination", "blue");

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

// Run
log("\n💡 Usage: node hackernews_scraper_paginated.js [total_posts]", "cyan");
log("   Example: node hackernews_scraper_paginated.js 60", "cyan");
log("   Default: 60 posts (2 pages)\n", "cyan");

scrapeHackerNewsPaginated().catch(console.error);
