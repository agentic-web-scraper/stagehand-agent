'use strict';

import { searchUrls, searchUrlsOnly, searchDetailed } from '../lib/searchUrls.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

function assertTrue(value, message) {
  if (value !== true) {
    throw new Error(`${message}\n   Expected: true\n   Actual: ${value}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n   Expected: ${expected}\n   Actual: ${actual}`);
  }
}

function assertArray(actual, message) {
  if (!Array.isArray(actual)) {
    throw new Error(`${message}\n   Expected: Array\n   Actual: ${typeof actual}`);
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  TDD Test Suite: searchUrls (SearXNG)                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  await test('searchUrls returns success for valid query', async () => {
    const result = await searchUrls('JavaScript', 3);
    assertTrue(result.success === true, 'Result should have success=true');
    assertTrue(result.count > 0, 'Should return at least 1 result');
    assertArray(result.results, 'Result should contain results array');
  });

  await test('searchUrls returns structured data with title, url, snippet', async () => {
    const result = await searchUrls('React documentation', 3);
    assertTrue(result.success === true, 'Should succeed');
    
    if (result.count > 0) {
      const firstResult = result.results[0];
      assertTrue(typeof firstResult.title === 'string', 'Each result should have title');
      assertTrue(typeof firstResult.url === 'string', 'Each result should have url');
      assertTrue(typeof firstResult.snippet === 'string', 'Each result should have snippet');
    }
  });

  await test('searchUrlsOnly returns only URLs array', async () => {
    const result = await searchUrlsOnly('Node.js', 3);
    assertTrue(result.success === true, 'Should succeed');
    assertTrue(result.count > 0, 'Should return at least 1 URL');
    assertArray(result.urls, 'Should contain urls array');
    
    if (result.count > 0) {
      assertTrue(result.urls[0].startsWith('http'), 'First URL should start with http');
    }
  });

  await test('searchDetailed returns detailed search results', async () => {
    const result = await searchDetailed('Python', 3);
    assertTrue(result.success === true, 'Should succeed');
    assertTrue(result.count > 0, 'Should return results');
    assertArray(result.results, 'Should contain results array');
  });

  await test('searchUrls respects maxResults parameter', async () => {
    const result = await searchUrls('testing', 5);
    assertTrue(result.success === true, 'Should succeed');
    assertTrue(result.count <= 5, `Should return at most 5 results, got ${result.count}`);
  });

  await test('searchUrls includes original query in result', async () => {
    const query = 'specific test query';
    const result = await searchUrls(query, 3);
    assertTrue(result.success === true, 'Should succeed');
    assertEqual(result.query, query, 'Result should include original query');
  });

  console.log('\n' + '═'.repeat(60));
  console.log(`Tests completed: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
