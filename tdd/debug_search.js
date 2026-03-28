'use strict';

import { searchUrls } from '../lib/searchUrls.js';

async function debug() {
  console.log('Testing searchUrls...\n');
  
  const result = await searchUrls('JavaScript', 3);
  console.log('Result:', JSON.stringify(result, null, 2));
}

debug();
