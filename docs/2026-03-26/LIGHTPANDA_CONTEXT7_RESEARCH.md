# Lightpanda Research (Context7)

Date: 2026-03-26
Source: Context7 MCP search and docs fetch

## Library Matches Found

1. /lightpanda-io/browser
- Description: Headless browser designed for AI and automation
- Code snippets: 1113
- Trust score: 7.8

2. /websites/lightpanda_io
- Description: AI-native browser for machine-driven automation with Playwright and Puppeteer compatibility
- Code snippets: 89
- Trust score: 8

## Key Findings

- Lightpanda exposes a Chrome DevTools Protocol (CDP) endpoint.
- You can control it with standard clients:
  - puppeteer-core
  - playwright-core
- Two deployment modes are documented:
  - Open-source local server
  - Managed cloud endpoint with token authentication

## Local Open-Source Flow

1. Start the CDP server

- Example command:
  - ./lightpanda serve --obey_robots --host 127.0.0.1 --port 9222

2. Connect automation clients

- Puppeteer: browserWSEndpoint = ws://127.0.0.1:9222
- Playwright: connectOverCDP("ws://127.0.0.1:9222")

## Cloud Flow

- Connect to WebSocket endpoint with token:
  - wss://euwest.cloud.lightpanda.io/ws?token=YOUR_TOKEN
- Works for both Puppeteer and Playwright CDP connections.

## Dependencies Mentioned in Docs

- npm install -save puppeteer-core
- npm install -save playwright-core

## Additional Capabilities Mentioned

- Proxy configuration is supported (for browser context and/or connection setup depending on toolchain).
- Stagehand integration guides are documented.
- Example production scripts show navigation, interaction, wait strategy, and data extraction.

## Practical Notes For This Workspace

- Lightpanda can be used as a browser backend while keeping current extraction logic.
- Migration impact is mostly in browser connection/bootstrap code (CDP endpoint wiring).
- Good path for reliability:
  1. Start local Lightpanda server.
  2. Connect using Playwright Core or Puppeteer Core.
  3. Keep extraction and pagination logic deterministic.
  4. Add deduplication and page-limit guards.

## Suggested Next Steps

1. Add a minimal Lightpanda connection script in this folder for quick verification.
2. Add a pagination test script against Hacker News to validate multi-page extraction.
3. Add retry/timeouts and structured JSON output checks for robust automation.
