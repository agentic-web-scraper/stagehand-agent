/**
 * Tests for CSS Schema Generator
 * 
 * Run with: node tests/cssSchemaGenerator.test.js
 */

import {
  validateSchema,
  testSchemaOnHTML,
  calculateConfidence,
  preprocessHTML
} from '../lib/generateSchemaUtil.js';

// Simple test framework
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Sample data for tests
const validSchema = {
  name: 'Test Schema',
  baseSelector: '.product',
  fields: [
    { name: 'title', selector: '.title', type: 'text' },
    { name: 'price', selector: '.price', type: 'text' }
  ]
};

const sampleHTML = `
  <div class="product">
    <h2 class="title">Product 1</h2>
    <span class="price">$99.99</span>
  </div>
  <div class="product">
    <h2 class="title">Product 2</h2>
    <span class="price">$149.99</span>
  </div>
`;

// ============================================================================
// Validation Tests
// ============================================================================

console.log('\n📋 Testing Schema Validation\n');

test('validateSchema: accepts valid schema', () => {
  const result = validateSchema(validSchema);
  assert(result.valid === true, 'Should be valid');
  assert(result.errors.length === 0, 'Should have no errors');
});

test('validateSchema: rejects schema without name', () => {
  const schema = { ...validSchema };
  delete schema.name;
  const result = validateSchema(schema);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('name')), 'Should mention missing name');
});

test('validateSchema: rejects schema without baseSelector', () => {
  const schema = { ...validSchema };
  delete schema.baseSelector;
  const result = validateSchema(schema);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('baseSelector')), 'Should mention missing baseSelector');
});

test('validateSchema: rejects schema without fields', () => {
  const schema = { ...validSchema };
  delete schema.fields;
  const result = validateSchema(schema);
  assert(result.valid === false, 'Should be invalid');
  assert(result.errors.some(e => e.includes('fields')), 'Should mention missing fields');
});

test('validateSchema: rejects empty fields array', () => {
  const schema = { ...validSchema, fields: [] };
  const result = validateSchema(schema);
  assert(result.valid === false, 'Should be invalid');
});

test('validateSchema: validates field types', () => {
  const schema = {
    ...validSchema,
    fields: [{ name: 'test', selector: '.test', type: 'invalid_type' }]
  };
  const result = validateSchema(schema);
  assert(result.valid === false, 'Should reject invalid type');
});

test('validateSchema: accepts valid field types', () => {
  const types = ['text', 'attribute', 'html', 'regex', 'number'];
  types.forEach(type => {
    const schema = {
      ...validSchema,
      fields: [{ name: 'test', selector: '.test', type }]
    };
    const result = validateSchema(schema);
    if (type === 'attribute') {
      // attribute type requires attribute property
      assert(result.valid === false, `Should require attribute property for ${type}`);
    } else if (type === 'regex') {
      // regex type requires pattern property
      assert(result.valid === false, `Should require pattern property for ${type}`);
    } else {
      assert(result.valid === true, `Should accept ${type} type`);
    }
  });
});

test('validateSchema: requires attribute field for attribute type', () => {
  const schema = {
    ...validSchema,
    fields: [{ name: 'link', selector: 'a', type: 'attribute' }]
  };
  const result = validateSchema(schema);
  assert(result.valid === false, 'Should require attribute property');
});

// ============================================================================
// HTML Testing Tests
// ============================================================================

console.log('\n🧪 Testing HTML Schema Testing\n');

test('testSchemaOnHTML: validates baseSelector', () => {
  const result = testSchemaOnHTML(validSchema, sampleHTML);
  assert(result.baseSelectorValid === true, 'baseSelector should be valid');
  assert(result.itemsFound > 0, 'Should find items');
});

test('testSchemaOnHTML: counts items correctly', () => {
  const result = testSchemaOnHTML(validSchema, sampleHTML);
  assert(result.itemsFound === 2, 'Should find 2 products');
});

test('testSchemaOnHTML: tests field selectors', () => {
  const result = testSchemaOnHTML(validSchema, sampleHTML);
  assert(result.fieldResults.length > 0, 'Should have field results');
  assert(result.fieldResults.every(f => f.found), 'All fields should be found');
});

test('testSchemaOnHTML: detects invalid baseSelector', () => {
  const schema = { ...validSchema, baseSelector: '.nonexistent' };
  const result = testSchemaOnHTML(schema, sampleHTML);
  assert(result.baseSelectorValid === false, 'Should detect invalid selector');
  assert(result.itemsFound === 0, 'Should find no items');
});

test('testSchemaOnHTML: handles empty HTML', () => {
  const result = testSchemaOnHTML(validSchema, '');
  assert(result.itemsFound === 0, 'Should find no items in empty HTML');
});

// ============================================================================
// Confidence Scoring Tests
// ============================================================================

console.log('\n📊 Testing Confidence Scoring\n');

test('calculateConfidence: returns score between 0 and 1', () => {
  const testResult = {
    baseSelectorValid: true,
    itemsFound: 5,
    fieldResults: [
      { name: 'title', found: true },
      { name: 'price', found: true }
    ]
  };
  const confidence = calculateConfidence(testResult, false); // post-extraction
  assert(typeof confidence === 'number', 'Should return number');
  assert(confidence >= 0 && confidence <= 1, 'Should be between 0 and 1');
});

test('calculateConfidence: returns neutral score for invalid pre-extraction', () => {
  const testResult = {
    baseSelectorValid: false,
    itemsFound: 0,
    fieldResults: []
  };
  const confidence = calculateConfidence(testResult, true); // pre-extraction
  assert(confidence === 0.5, 'Should be 0.5 (neutral) for pre-extraction with no items');
});

test('calculateConfidence: returns 0 for invalid post-extraction', () => {
  const testResult = {
    baseSelectorValid: false,
    itemsFound: 0,
    fieldResults: []
  };
  const confidence = calculateConfidence(testResult, false); // post-extraction
  assert(confidence === 0, 'Should be 0 for post-extraction failure');
});

test('calculateConfidence: higher score for more items', () => {
  const result1 = {
    baseSelectorValid: true,
    itemsFound: 1,
    fieldResults: [{ name: 'test', found: true }]
  };
  const result2 = {
    baseSelectorValid: true,
    itemsFound: 10,
    fieldResults: [{ name: 'test', found: true }]
  };
  const conf1 = calculateConfidence(result1, false);
  const conf2 = calculateConfidence(result2, false);
  assert(conf2 > conf1, 'More items should increase confidence');
});

test('calculateConfidence: considers field success rate', () => {
  const allSuccess = {
    baseSelectorValid: true,
    itemsFound: 5,
    fieldResults: [
      { name: 'f1', found: true },
      { name: 'f2', found: true }
    ]
  };
  const partialSuccess = {
    baseSelectorValid: true,
    itemsFound: 5,
    fieldResults: [
      { name: 'f1', found: true },
      { name: 'f2', found: false }
    ]
  };
  const conf1 = calculateConfidence(allSuccess, false);
  const conf2 = calculateConfidence(partialSuccess, false);
  assert(conf1 > conf2, 'All fields found should have higher confidence');
});

// ============================================================================
// HTML Preprocessing Tests
// ============================================================================

console.log('\n🧹 Testing HTML Preprocessing\n');

test('preprocessHTML: removes script tags', () => {
  const html = '<div>Content</div><script>alert("test")</script>';
  const result = preprocessHTML(html);
  assert(!result.includes('<script'), 'Should remove script tags');
  assert(result.includes('Content'), 'Should keep content');
});

test('preprocessHTML: removes style tags', () => {
  const html = '<div>Content</div><style>.test { color: red; }</style>';
  const result = preprocessHTML(html);
  assert(!result.includes('<style'), 'Should remove style tags');
  assert(result.includes('Content'), 'Should keep content');
});

test('preprocessHTML: removes HTML comments', () => {
  const html = '<div>Content</div><!-- This is a comment -->';
  const result = preprocessHTML(html);
  assert(!result.includes('<!--'), 'Should remove comments');
  assert(result.includes('Content'), 'Should keep content');
});

test('preprocessHTML: limits to 8KB', () => {
  const largeHTML = '<div>' + 'x'.repeat(20000) + '</div>';
  const result = preprocessHTML(largeHTML);
  assert(result.length <= 8195, 'Should limit to ~8KB (8192 + "...")'); // 8192 + "..."
});

test('preprocessHTML: handles empty HTML', () => {
  const result = preprocessHTML('');
  assert(result === '', 'Should return empty string');
});

test('preprocessHTML: handles null HTML', () => {
  const result = preprocessHTML(null);
  assert(result === '', 'Should return empty string for null');
});

// ============================================================================
// Integration Tests (Schema Generation with Refinement)
// ============================================================================

console.log('\n🔄 Testing Schema Refinement (Mock)\n');

test('Schema refinement: improves low confidence schemas', () => {
  // This is a conceptual test - actual refinement requires LLM calls
  // We're testing the logic flow
  
  const lowConfidenceResult = {
    baseSelectorValid: true,
    itemsFound: 1,  // Low count
    fieldResults: [
      { name: 'f1', found: true },
      { name: 'f2', found: false }  // One field missing
    ]
  };
  
  const confidence = calculateConfidence(lowConfidenceResult);
  assert(confidence < 0.7, 'Should have low confidence');
  
  // In real scenario, refinement would be triggered
  console.log(`   ℹ️  Low confidence (${(confidence * 100).toFixed(1)}%) would trigger refinement`);
});

test('Schema refinement: skips high confidence schemas', () => {
  const highConfidenceResult = {
    baseSelectorValid: true,
    itemsFound: 10,
    fieldResults: [
      { name: 'f1', found: true },
      { name: 'f2', found: true }
    ]
  };
  
  const confidence = calculateConfidence(highConfidenceResult);
  assert(confidence >= 0.7, 'Should have high confidence');
  
  console.log(`   ℹ️  High confidence (${(confidence * 100).toFixed(1)}%) would skip refinement`);
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total: ${passed + failed}`);
console.log('='.repeat(60) + '\n');

if (failed > 0) {
  process.exit(1);
}
