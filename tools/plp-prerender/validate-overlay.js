#!/usr/bin/env node
/**
 * Validates a deployed PLP overlay at a direct category URL.
 * Run: node tools/plp-prerender/validate-overlay.js
 */

const STORE_URL = process.env.STORE_URL || 'https://main--bvi-acs--ajay0641.aem.live';
const CATEGORY_PATH = process.env.TEST_CATEGORY_PATH || 'office/office-accessories';
const CATEGORY_ID = process.env.TEST_CATEGORY_ID || '18';
const PDP_PATH = process.env.TEST_PDP_PATH || '/products/itt743/ITT743';

const url = `${STORE_URL}/categories/${CATEGORY_PATH}/${CATEGORY_ID}`;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

async function main() {
  console.log(`Validating PLP overlay at ${url}\n`);

  const response = await fetch(url, { redirect: 'manual' });
  if (response.status !== 200) {
    fail(`Direct category URL returned HTTP ${response.status}`);
    return;
  }
  pass('Direct category URL returns HTTP 200');

  const html = await response.text();
  const checks = [
    ['ItemList JSON-LD', /"@type"\s*:\s*"ItemList"/.test(html)],
    ['BreadcrumbList JSON-LD', /"@type"\s*:\s*"BreadcrumbList"/.test(html)],
    ['category-list schema marker', /data-name="category-list"/.test(html)],
    ['canonical link', /<link[^>]+rel="canonical"/i.test(html)],
    ['prerendered PLP block', /data-prerendered="true"/.test(html)],
    ['semantic product links', /<a[^>]+href="[^"]*\/products\//i.test(html)],
  ];

  checks.forEach(([label, ok]) => {
    if (ok) pass(label);
    else fail(label);
  });

  const pdpResponse = await fetch(`${STORE_URL}${PDP_PATH}`, { redirect: 'manual' });
  if (pdpResponse.status === 200) {
    pass(`PDP regression: ${PDP_PATH} still returns HTTP 200`);
  } else {
    fail(`PDP regression: ${PDP_PATH} returned HTTP ${pdpResponse.status}`);
  }

  if (!process.exitCode) {
    console.log('\nOverlay validation passed. Safe to remove the category redirect in scripts/scripts.js.');
  }
}

main().catch((error) => {
  console.error('Validation failed:', error);
  process.exitCode = 1;
});
