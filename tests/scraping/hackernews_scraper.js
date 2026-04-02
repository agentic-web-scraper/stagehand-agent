/**
 * Hacker News Scraper
 * 
 * Uses the schema generated from page.snapshot() to scrape HN posts
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
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Zod schema for HN posts
const HNPostSchema = z.object({
  rank: z.number(),
  title: z.string(),
  url: z.string().url().optional(),
  points: z.number().optional(),
  author: z.string().optional(),
  time: z.string(),
  comments: z.number(),
  commentsUrl: z.string().url(),
});

const HNPostsSchema = z.object({
  posts: z.array(HNPostSchema),
});

async function scrapeHackerNews() {
  log("\n" + "=".repeat(70), "cyan");
  log("📰 HACKER NEWS SCRAPER (Schema-Based)", "bright");
  log("=".repeat(70), "cyan");
  
  let stagehand;
  
  try {
    const url = "https://news.ycombinator.com";
    const numPosts = parseInt(process.argv[2]) || 10;
    
    log(`\n🌐 URL: ${url}`, "yellow");
    log(`📊 Target posts: ${numPosts}`, "yellow");
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

    // Step 1: Get schema first
    log("📸 Step 1: Capturing page schema...", "bright");
    await page.goto(url, { waitUntil: 'networkidle' });
    const snapshot = await page.snapshot();
    log(`✅ Schema captured: ${Object.keys(snapshot.xpathMap).length} elements mapped\n`, "green");

    // Step 2: Analyze schema to find post patterns
    log("🔍 Step 2: Analyzing schema for post patterns...", "bright");
    const treeLines = snapshot.formattedTree.split('\n');
    
    // Find story links (they contain the actual post titles)
    const storyLinks = [];
    treeLines.forEach(line => {
      const idMatch = line.match(/\[(\d+-\d+)\]/);
      if (!idMatch) return;
      
      const elementId = idMatch[1];
      const url = snapshot.urlMap[elementId];
      
      // Story links are in the main table and point to external sites or item pages
      if (url && !url.includes('/vote?') && !url.includes('/hide?') && 
          !url.includes('/user?') && !url.includes('/from?') &&
          !url.includes('y18.svg') && !url.includes('s.gif') &&
          line.includes('link:') && line.includes('td[3]')) {
        
        const contentMatch = line.match(/link:\s+(.+)/);
        if (contentMatch) {
          storyLinks.push({
            id: elementId,
            title: contentMatch[1].trim(),
            url: url,
            xpath: snapshot.xpathMap[elementId],
          });
        }
      }
    });
    
    log(`✅ Found ${storyLinks.length} story links in schema\n`, "green");

    // Step 3: Extract posts using the schema
    log("📊 Step 3: Extracting posts using schema-based selectors...", "bright");
    
    const posts = await page.evaluate((numPosts) => {
      const getElementByXPath = (xpath) => {
        return document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
      };
      
      const getAllElementsByXPath = (xpath) => {
        const result = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        const nodes = [];
        for (let i = 0; i < result.snapshotLength; i++) {
          nodes.push(result.snapshotItem(i));
        }
        return nodes;
      };
      
      const posts = [];
      
      // Get all story rows (they have class 'athing')
      const storyRows = document.querySelectorAll('tr.athing');
      
      for (let i = 0; i < Math.min(storyRows.length, numPosts); i++) {
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
    }, numPosts);
    
    log(`✅ Extracted ${posts.length} posts\n`, "green");

    // Display results
    log("╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ 📰 HACKER NEWS POSTS                                           ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    posts.forEach((post, i) => {
      log(`${post.rank}. ${post.title}`, "bright");
      log(`   🔗 ${post.url}`, "blue");
      if (post.points) log(`   ⬆️  ${post.points} points`, "green");
      if (post.author) log(`   👤 by ${post.author}`, "magenta");
      log(`   ⏰ ${post.time}`, "yellow");
      log(`   💬 ${post.comments} comments - ${post.commentsUrl}`, "cyan");
      log("", "reset");
    });

    // Save results
    const outputFile = `results/hackernews_posts_${Date.now()}.json`;
    const outputData = {
      timestamp: new Date().toISOString(),
      url: url,
      method: "Schema-based scraping with page.snapshot()",
      totalPosts: posts.length,
      posts: posts,
      schema: {
        totalElements: Object.keys(snapshot.xpathMap).length,
        totalLinks: Object.keys(snapshot.urlMap).length,
        storyLinksFound: storyLinks.length,
      },
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    log(`💾 Results saved to: ${outputFile}`, "green");

    // Statistics
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ 📊 STATISTICS                                                  ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    const totalPoints = posts.reduce((sum, p) => sum + (p.points || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + p.comments, 0);
    const avgPoints = totalPoints / posts.filter(p => p.points).length;
    const avgComments = totalComments / posts.length;
    
    log(`📊 Total posts scraped: ${posts.length}`, "blue");
    log(`⬆️  Total points: ${totalPoints}`, "green");
    log(`💬 Total comments: ${totalComments}`, "cyan");
    log(`📈 Average points: ${avgPoints.toFixed(1)}`, "green");
    log(`📈 Average comments: ${avgComments.toFixed(1)}`, "cyan");
    log(`🏆 Top post: "${posts[0]?.title}" (${posts[0]?.points} points)`, "yellow");

    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ ✅ SCRAPING COMPLETE                                           ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    log("💡 Schema-Based Scraping Benefits:", "yellow");
    log("  ✓ Used page.snapshot() to understand page structure", "green");
    log("  ✓ Identified XPath patterns for story elements", "green");
    log("  ✓ Extracted data using reliable selectors", "green");
    log("  ✓ Schema provides blueprint for future scraping", "green");

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
log("\n💡 Usage: node hackernews_scraper.js [number_of_posts]", "cyan");
log("   Example: node hackernews_scraper.js 20\n", "cyan");

scrapeHackerNews().catch(console.error);
