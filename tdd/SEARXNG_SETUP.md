# SearXNG Setup Guide for searchUrls.js

## Issue: 403 Forbidden Error

Your local SearXNG instance at `http://localhost:8888` is returning **403 Forbidden** when requesting JSON format. This happens because JSON output is disabled by default in SearXNG.

## Solution: Enable JSON Format in SearXNG

### Step 1: Locate SearXNG Configuration

Find your SearXNG `settings.yml` file. Common locations:
- Docker: `/etc/searxng/settings.yml` (inside container)
- Direct install: `/etc/searxng/settings.yml`

### Step 2: Edit settings.yml

Add or modify the `search` section to enable JSON format:

```yaml
search:
  formats:
    - html
    - json
    - csv
    - rss
```

Or minimal configuration:

```yaml
search:
  formats:
    - html
    - json
```

### Step 3: Restart SearXNG

```bash
# If using Docker
docker restart <searxng-container-name>

# If running directly
sudo systemctl restart searxng
```

### Step 4: Verify JSON is Working

```bash
curl "http://localhost:8888/search?q=test&format=json"
```

You should see JSON output instead of HTML.

## Complete Example settings.yml

```yaml
# SearXNG settings.yml
use_default_settings: true

server:
  port: 8888
  bind_address: "0.0.0.0"

search:
  formats:
    - html
    - json
  autocomplete: ""
  safesearch: 0
```

## Environment Variable

The `searchUrls.js` module supports custom SearXNG URLs via environment variable:

```bash
export SEARXNG_URL="http://localhost:8888"
node tdd/searchUrls.test.js
```

## Testing

Once JSON is enabled, run the TDD tests:

```bash
node tdd/searchUrls.test.js
```

## Troubleshooting

### Still getting 403?

Check if your IP is blocked:
```bash
curl -v "http://localhost:8888/search?q=test&format=json"
```

### Using Docker?

Mount custom settings.yml:
```yaml
# docker-compose.yml
services:
  searxng:
    volumes:
      - ./settings.yml:/etc/searxng/settings.yml:ro
```

### Alternative: Use POST instead of GET

If GET requests are blocked, try POST:
```bash
curl -X POST "http://localhost:8888/search" \
  -d "q=test" \
  -d "format=json"
```

## API Response Format

Successful JSON response:
```json
{
  "query": "javascript",
  "number_of_results": 100,
  "results": [
    {
      "url": "https://developer.mozilla.org/...",
      "title": "JavaScript | MDN",
      "content": "JavaScript is a programming language..."
    }
  ]
}
```

---

**Note:** The `searchUrls.js` module expects this JSON format from SearXNG.
