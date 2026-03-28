# SearXNG Docker Setup

This folder contains a Docker Compose configuration for running SearXNG with JSON format enabled for the `searchUrls.js` integration.

## Files

- **docker-compose.yml** - Docker Compose configuration
- **settings.yml** - SearXNG settings with JSON format enabled

## Quick Start

From this directory:

```bash
# Start SearXNG
docker compose up -d

# Verify it's running
curl "http://localhost:8888/search?q=test&format=json"

# Run tests from project root
cd ../
node tdd/searchUrls.test.js

# Stop SearXNG
docker compose down
```

## Configuration

- **Port**: 8888
- **Formats Enabled**: HTML, JSON
- **Bind Address**: 127.0.0.1 (localhost only)

## For Production

To make this accessible from outside localhost, edit `settings.yml`:

```yaml
server:
  bind_address: "0.0.0.0"  # Changed from "127.0.0.1"
```

Then restart:

```bash
docker compose restart
```
