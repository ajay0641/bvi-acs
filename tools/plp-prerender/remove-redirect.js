#!/usr/bin/env node
/**
 * Removes the category redirect from scripts/scripts.js after overlay validation passes.
 * Run: node tools/plp-prerender/remove-redirect.js
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const scriptsPath = resolve(here, '../../scripts/scripts.js');
const validateScript = resolve(here, 'validate-overlay.js');

const validate = spawnSync(process.execPath, [validateScript], { encoding: 'utf8' });
process.stdout.write(validate.stdout || '');
process.stderr.write(validate.stderr || '');

if (validate.status !== 0) {
  console.error('\nRedirect not removed. Deploy and validate the overlay first.');
  process.exit(validate.status || 1);
}

const redirectBlock = `  // Folder mapping (/categories/: → /categories/default) is deprecated and often
  // unavailable locally / until site config is updated via Helix Admin API.
  // Redirect to the template and pass the original path so PLP can resolve urlPath.
  const { pathname } = window.location;
  if (pathname.startsWith('/categories/') && pathname !== '/categories/default') {
    window.location.replace(\`/categories/default?cp=\${encodeURIComponent(pathname)}\`);
    return;
  }

`;

let source = readFileSync(scriptsPath, 'utf8');
if (!source.includes(redirectBlock.trim())) {
  console.log('Category redirect already removed from scripts/scripts.js');
  process.exit(0);
}

source = source.replace(redirectBlock, '');
writeFileSync(scriptsPath, source);
console.log('Removed category redirect from scripts/scripts.js');
