# Lightpanda Setup and Health Check Guide

## Overview

Lightpanda is an AI-native headless browser built from scratch for automation. It uses Chrome DevTools Protocol (CDP) to allow tools like Stagehand, Puppeteer, and Playwright to control it.

## Prerequisites

- Lightpanda binary installed (`./lightpanda` in project root)
- Node.js 18+
- Azure OpenAI credentials in `.env` file

## Starting Lightpanda

### Option 1: Using the provided script

```bash
./scripts/start_lightpanda.sh
```

This will start Lightpanda on `ws://127.0.0.1:9222`

### Option 2: Manual start

```bash
./lightpanda serve --host 127.0.0.1 --port 9222
```

### Option 3: With logging

```bash
./lightpanda serve --host 127.0.0.1 --port 9222 --log_level info --log_format pretty
```

You should see output like:
```
🚀 Starting Lightpanda browser...
✅ Lightpanda started with PID: 12345
📡 CDP endpoint: ws://127.0.0.1:9222
```

## Checking if Lightpanda is Working

### Quick Check (Recommended)

Run the health check script:

```bash
node scripts/check_lightpanda.js
```

This will:
- ✅ Check HTTP endpoint connectivity
- ✅ Display version information
- ✅ Check WebSocket endpoint
- ✅ List available targets
- ✅ Show connection details

**Expected output:**
```
╔════════════════════════════════════════════════════════════════╗
║          🔍 LIGHTPANDA HEALTH CHECK                           ║
╚════════════════════════════════════════════════════════════════╝

1️⃣  Checking HTTP endpoint...
   Endpoint: http://127.0.0.1:9222
   ✅ HTTP endpoint is responding

   📊 Version Information:
      • Browser: Lightpanda/1.0.0
      • Protocol Version: 1.3
      • User-Agent: Lightpanda/1.0.0
      • WebSocket Debugger URL: ws://127.0.0.1:9222

2️⃣  Checking WebSocket endpoint...
   Endpoint: ws://127.0.0.1:9222
   ✅ WebSocket endpoint is responding

3️⃣  Checking available targets...
   ✅ Found 0 target(s)

✅ LIGHTPANDA IS WORKING CORRECTLY!
```

### Manual Checks

#### Check 1: HTTP Endpoint

```bash
curl http://127.0.0.1:9222/json/version
```

Expected response:
```json
{
  "Browser": "Lightpanda/1.0.0",
  "Protocol-Version": "1.3",
  "User-Agent": "Lightpanda/1.0.0",
  "webSocketDebuggerUrl": "ws://127.0.0.1:9222"
}
```

#### Check 2: List Targets

```bash
curl http://127.0.0.1:9222/json/list
```

Expected response:
```json
[]
```

(Empty array is normal when no pages are open)

#### Check 3: Port is Listening

```bash
lsof -i :9222
```

Expected output:
```
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
lightpand 123 user   10u  IPv4  12345      0t0  TCP 127.0.0.1:9222 (LISTEN)
```

#### Check 4: Process is Running

```bash
ps aux | grep lightpanda
```

Expected output:
```
user  12345  0.5  2.3 123456 78901 ?  Sl  10:30  0:05 ./lightpanda serve --host 127.0.0.1 --port 9222
```

## Troubleshooting

### Issue: "Connection refused"

**Cause:** Lightpanda is not running

**Solution:**
```bash
# Start Lightpanda
./lightpanda serve --host 127.0.0.1 --port 9222

# In another terminal, check it's running
node scripts/check_lightpanda.js
```

### Issue: "Port 9222 already in use"

**Cause:** Another process is using port 9222

**Solution:**
```bash
# Find what's using the port
lsof -i :9222

# Kill the process
kill -9 <PID>

# Or use a different port
./lightpanda serve --host 127.0.0.1 --port 9223
```

### Issue: "Lightpanda binary not found"

**Cause:** Lightpanda executable is missing

**Solution:**
```bash
# Check if it exists
ls -la ./lightpanda

# If not, download it from https://lightpanda.io/docs/open-source/usage
# Or check the project README for installation instructions
```

### Issue: "WebSocket connection timeout"

**Cause:** Lightpanda is running but not responding to WebSocket connections

**Solution:**
```bash
# Check if HTTP endpoint works
curl http://127.0.0.1:9222/json/version

# If HTTP works but WebSocket doesn't, try restarting Lightpanda
pkill lightpanda
./lightpanda serve --host 127.0.0.1 --port 9222
```

## Using with Stagehand

Once Lightpanda is running and verified, you can use it with the autonomous scraper:

```bash
# Interactive mode
node web_scraping/autonomous_scraper_lightpanda.js

# Non-interactive with arguments
node web_scraping/autonomous_scraper_lightpanda.js \
  --prompt "Scrape 60 books from booktoscrape.com" \
  --steps 50

# Short form
node web_scraping/autonomous_scraper_lightpanda.js \
  -p "Find React tutorials" \
  -s 30
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Script                              │
│         (autonomous_scraper_lightpanda.js)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Stagehand
                     │ (browserWSEndpoint: ws://127.0.0.1:9222)
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Chrome DevTools Protocol (CDP)                 │
│                    WebSocket Connection                     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Lightpanda Browser                         │
│         (AI-native, low memory, fast startup)               │
│                                                              │
│  • V8 JavaScript Engine                                     │
│  • HTML Parser + DOM                                        │
│  • Network Loading (libcurl)                                │
│  • Cookie & Proxy Support                                   │
└─────────────────────────────────────────────────────────────┘
```

## Performance Tips

1. **Keep Lightpanda running** - Start it once and reuse the connection
2. **Use appropriate timeouts** - Set reasonable navigation and action timeouts
3. **Monitor memory** - Lightpanda is lightweight, but monitor for long-running sessions
4. **Batch operations** - Group multiple scraping tasks in one session when possible
5. **Clean up resources** - Always close pages and contexts when done

## Next Steps

1. ✅ Start Lightpanda: `./lightpanda serve --host 127.0.0.1 --port 9222`
2. ✅ Verify it's working: `node scripts/check_lightpanda.js`
3. ✅ Run the scraper: `node web_scraping/autonomous_scraper_lightpanda.js`

## References

- [Lightpanda GitHub](https://github.com/lightpanda-io/browser)
- [Lightpanda Documentation](https://lightpanda.io/docs)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Stagehand Documentation](https://docs.browserbase.com/stagehand)
