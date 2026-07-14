#!/usr/bin/env node
/**
 * Verifies prerequisites for PLP prerender overlay deployment.
 * Run from repo root: node tools/plp-prerender/verify-access.js
 */

const STORE_URL = process.env.STORE_URL || 'https://main--bvi-acs--ajay0641.aem.live';
const ORG = process.env.ORG || 'ajay0641';
const SITE = process.env.SITE || 'bvi-acs';
const TEST_CATEGORY_PATH = process.env.TEST_CATEGORY_PATH || 'office/office-accessories';
const TEST_CATEGORY_ID = process.env.TEST_CATEGORY_ID || '18';

const checks = [];

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
  console.log(`✓ ${name}: ${detail}`);
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
  console.error(`✗ ${name}: ${detail}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function verifyStoreConfig() {
  const config = await fetchJson(`${STORE_URL}/config.json`);
  const defaults = config?.public?.default || {};
  const endpoint = defaults['commerce-endpoint'];
  const headers = defaults.headers?.cs || {};

  if (!endpoint) {
    fail('Catalog Service config', 'commerce-endpoint missing from config.json');
    return null;
  }

  pass('Catalog Service config', `endpoint present (${endpoint})`);

  const required = [
    'AC-Environment-Id',
    'AC-View-ID',
  ];
  const missing = required.filter((key) => !headers[key]);
  if (missing.length) {
    fail('Catalog Service headers', `missing: ${missing.join(', ')}`);
    return null;
  }

  pass('Catalog Service headers', 'AC-Environment-Id and AC-View-ID present');
  return {
    endpoint,
    headers,
    storeUrl: defaults.analytics?.['store-url'] || STORE_URL,
    config: defaults,
  };
}

async function verifyCategoryTemplate() {
  const response = await fetch(`${STORE_URL}/categories/default.plain.html`);
  if (!response.ok) {
    fail('Category template', `categories/default returned HTTP ${response.status}`);
    return false;
  }
  const html = await response.text();
  if (!html.includes('product-list-page')) {
    fail('Category template', 'categories/default is missing product-list-page block');
    return false;
  }
  pass('Category template', 'categories/default contains product-list-page block');
  return true;
}

async function verifyCatalogCategories({ endpoint, headers, storeUrl, config }) {
  const query = `
    query VerifyCategories($ids: [String!]!, $roles: [String!]!) {
      categories(ids: $ids, roles: $roles, subtree: { depth: 20, startLevel: 1 }) {
        id
        name
        urlPath
      }
    }
  `;

  const mergedHeaders = {
    'Content-Type': 'application/json',
    origin: storeUrl,
    ...(config?.headers?.all || {}),
    ...(config?.headers?.cs || headers),
    'Magento-Is-Preview': 'true',
  };

  const url = new URL(endpoint);
  const hash = Object.entries(config?.headers?.cs || headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join('|')
    .split('')
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 2147483647, 0)
    .toString(36)
    .slice(0, 5);
  url.searchParams.set('cb', hash);

  const response = await fetch(url, {
    method: 'POST',
    headers: mergedHeaders,
    body: JSON.stringify({
      operationName: 'VerifyCategories',
      query,
      variables: { ids: ['2'], roles: ['active'] },
    }),
  });

  if (!response.ok) {
    fail('Catalog Service API', `GraphQL request failed with HTTP ${response.status}`);
    return null;
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    fail('Catalog Service API', payload.errors.map((e) => e.message).join('; '));
    return null;
  }

  const categories = payload.data?.categories || [];
  pass('Catalog Service API', 'categories query succeeded');
  if (!categories.length) {
    fail(
      'Catalog categories',
      '0 active categories returned; populate catalog or verify AC-Environment-Id / AC-View-ID',
    );
    return null;
  }

  pass('Catalog categories', `${categories.length} active categories returned`);
  const target = categories.find(
    (category) => String(category.id) === TEST_CATEGORY_ID
      || category.urlPath === TEST_CATEGORY_PATH,
  );
  if (target) {
    pass('Test category', `${target.name} (${target.urlPath}/${target.id})`);
  } else {
    fail('Test category', `category ${TEST_CATEGORY_PATH}/${TEST_CATEGORY_ID} not found in catalog`);
  }
  return categories;
}

async function verifyDirectCategoryUrl() {
  const url = `${STORE_URL}/categories/${TEST_CATEGORY_PATH}/${TEST_CATEGORY_ID}`;
  const response = await fetch(url, { redirect: 'manual' });
  if (response.status === 200) {
    pass('Direct category URL', `${url} returns HTTP 200 (overlay ready)`);
    return true;
  }
  fail(
    'Direct category URL',
    `${url} returns HTTP ${response.status}; keep storefront redirect until overlay is deployed`,
  );
  return false;
}

async function verifyAppBuilderCli() {
  const { execSync } = await import('node:child_process');
  try {
    const version = execSync('aio --version', { encoding: 'utf8' }).trim();
    pass('App Builder CLI', `aio ${version} installed`);
    return true;
  } catch {
    fail('App Builder CLI', 'aio CLI not found; install with npm install -g @adobe/aio-cli');
    return false;
  }
}

async function verifyPrerenderFork() {
  const { existsSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const forkPath = resolve(here, '../../../aem-commerce-prerender');
  const required = [
    'actions/category-renderer/render.js',
    'actions/sync-categories/index.js',
    'app.config.yaml',
    'PLP-PRERENDER.md',
  ];

  if (!existsSync(forkPath)) {
    fail('Prerender fork', `expected sibling repo at ${forkPath}`);
    return false;
  }

  const missing = required.filter((file) => !existsSync(resolve(forkPath, file)));
  if (missing.length) {
    fail('Prerender fork', `missing files: ${missing.join(', ')}`);
    return false;
  }

  pass('Prerender fork', `PLP extension present at ${forkPath}`);
  return true;
}

async function verifyAdminApiToken() {
  const token = process.env.AEM_ADMIN_API_AUTH_TOKEN;
  if (!token) {
    fail(
      'AEM Admin API token',
      'AEM_ADMIN_API_AUTH_TOKEN not set; required for sync-categories publish step',
    );
    return false;
  }

  const response = await fetch(`https://admin.hlx.page/config/${ORG}/sites.json`, {
    headers: { 'x-auth-token': token },
  });
  if (!response.ok) {
    fail('AEM Admin API token', `sites.json returned HTTP ${response.status}`);
    return false;
  }

  const sites = await response.json();
  const site = sites?.data?.find((entry) => entry.id === SITE || entry.name === SITE);
  if (!site) {
    fail('AEM Admin API token', `site ${SITE} not found for org ${ORG}`);
    return false;
  }

  pass('AEM Admin API token', `authenticated for org ${ORG}, site ${SITE}`);
  return true;
}

async function main() {
  console.log(`Verifying PLP prerender prerequisites for ${STORE_URL}\n`);

  await verifyAppBuilderCli();
  await verifyPrerenderFork();
  await verifyAdminApiToken();

  const config = await verifyStoreConfig();
  await verifyCategoryTemplate();
  if (config) {
    await verifyCatalogCategories(config);
  }
  await verifyDirectCategoryUrl();

  const failed = checks.filter((check) => !check.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    console.log('\nBlocked checks:');
    failed.forEach((check) => console.log(`  - ${check.name}: ${check.detail}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Verification failed:', error);
  process.exitCode = 1;
});
