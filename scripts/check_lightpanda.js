#!/usr/bin/env node
'use strict';

import fetch from 'node-fetch';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkLightpanda() {
  log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
  log("║          🔍 LIGHTPANDA HEALTH CHECK                           ║", "cyan");
  log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

  const cdpEndpoint = "http://127.0.0.1:9222";
  const wsEndpoint = "ws://127.0.0.1:9222";

  try {
    // Check 1: HTTP endpoint
    log("1️⃣  Checking HTTP endpoint...", "bright");
    log(`   Endpoint: ${cdpEndpoint}`, "blue");
    
    const response = await fetch(`${cdpEndpoint}/json/version`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const versionData = await response.json();
    
    log("   ✅ HTTP endpoint is responding", "green");
    log(`\n   📊 Version Information:`, "bright");
    log(`      • Browser: ${versionData.Browser || 'N/A'}`, "blue");
    log(`      • Protocol Version: ${versionData['Protocol-Version'] || 'N/A'}`, "blue");
    log(`      • User-Agent: ${versionData['User-Agent'] || 'N/A'}`, "blue");
    log(`      • WebSocket Debugger URL: ${versionData['webSocketDebuggerUrl'] || 'N/A'}`, "blue");

    // Check 2: WebSocket endpoint
    log(`\n2️⃣  Checking WebSocket endpoint...`, "bright");
    log(`   Endpoint: ${wsEndpoint}`, "blue");
    
    try {
      const ws = new (await import('ws')).default(wsEndpoint, {
        handshakeTimeout: 5000,
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      log("   ✅ WebSocket endpoint is responding", "green");
      ws.close();
    } catch (wsError) {
      log(`   ⚠️  WebSocket check failed: ${wsError.message}`, "yellow");
      log("   (This might be normal if using HTTP-only connection)", "yellow");
    }

    // Check 3: List available targets
    log(`\n3️⃣  Checking available targets...`, "bright");
    
    const targetsResponse = await fetch(`${cdpEndpoint}/json/list`);
    const targets = await targetsResponse.json();
    
    log(`   ✅ Found ${targets.length} target(s)`, "green");
    targets.forEach((target, index) => {
      log(`      ${index + 1}. ${target.type} - ${target.title || 'Untitled'}`, "blue");
    });

    // Final status
    log("\n" + "=".repeat(70), "cyan");
    log("✅ LIGHTPANDA IS WORKING CORRECTLY!", "green");
    log("=".repeat(70), "cyan");
    
    log("\n📝 Connection Details:", "bright");
    log(`   • HTTP Endpoint: ${cdpEndpoint}`, "blue");
    log(`   • WebSocket Endpoint: ${wsEndpoint}`, "blue");
    log(`   • Status: Ready for automation`, "green");
    
    log("\n🚀 You can now run:", "bright");
    log(`   node web_scraping/autonomous_scraper_lightpanda.js`, "yellow");
    log(`   node web_scraping/autonomous_scraper_lightpanda.js --prompt "Your task here" --steps 50\n`, "yellow");

  } catch (error) {
    log("\n" + "=".repeat(70), "cyan");
    log("❌ LIGHTPANDA IS NOT RUNNING", "red");
    log("=".repeat(70), "cyan");
    
    log(`\n❌ Error: ${error.message}`, "red");
    
    log("\n📋 To start Lightpanda:", "bright");
    log("   1. Open a terminal", "blue");
    log("   2. Run: ./lightpanda serve --host 127.0.0.1 --port 9222", "yellow");
    log("   3. Wait for it to start (you should see 'listening on' message)", "blue");
    log("   4. Then run this check again", "blue");
    
    log("\n💡 Troubleshooting:", "bright");
    log("   • Make sure Lightpanda binary exists: ls -la ./lightpanda", "blue");
    log("   • Check if port 9222 is already in use: lsof -i :9222", "blue");
    log("   • Try a different port: ./lightpanda serve --port 9223", "blue");
    
    process.exit(1);
  }
}

checkLightpanda().catch(console.error);
