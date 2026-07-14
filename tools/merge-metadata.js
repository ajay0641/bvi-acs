import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Shared column order — must match pdp-metadata so DA does not shift PLP values. */
const COLUMNS = [
  'URL',
  'title',
  'description',
  'keywords',
  'sku',
  'og:type',
  'og:title',
  'og:description',
  'og:url',
  'og:image',
  'og:image:secure_url',
  'last-modified',
  'json-ld',
  'cateId',
  'template',
];

function loadMetadata(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return content?.data?.data || [];
}

function normalizeRow(row) {
  const normalized = {};
  COLUMNS.forEach((key) => {
    normalized[key] = row[key] ?? '';
  });
  return normalized;
}

function mergeByUrl(rows) {
  const merged = new Map();
  rows.forEach((row) => {
    if (row?.URL) {
      merged.set(row.URL, { ...merged.get(row.URL), ...row });
    }
  });
  return [...merged.values()].map(normalizeRow);
}

const pdpFile = process.argv[2] || path.join(__dirname, 'pdp-metadata/metadata.json');
const plpFile = process.argv[3] || path.join(__dirname, 'plp-metadata/category-metadata.json');
const outputFile = process.argv[4] || path.join(__dirname, 'metadata.json');

const pdpRows = loadMetadata(pdpFile).filter((row) => row.URL?.includes('/products/'));
const plpRows = loadMetadata(plpFile).filter((row) => row.URL?.includes('/categories/'));

if (!pdpRows.length && !fs.existsSync(pdpFile)) {
  console.warn(`No PDP metadata found at ${pdpFile}. Run: cd tools/pdp-metadata && npm start`);
}
if (!plpRows.length && !fs.existsSync(plpFile)) {
  console.warn(`No PLP metadata found at ${plpFile}. Run: cd tools/plp-metadata && npm start`);
}

const rows = mergeByUrl([...pdpRows, ...plpRows]);

const jsonData = {
  data: {
    total: rows.length,
    limit: rows.length,
    offset: 0,
    data: rows,
    ':colWidths': COLUMNS.map(() => 100),
  },
  ':names': ['data'],
  ':version': 3,
  ':type': 'multi-sheet',
};

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(jsonData, null, 2));
console.log(`Merged ${rows.length} metadata rows (${pdpRows.length} PDP + ${plpRows.length} PLP) into ${outputFile}`);
