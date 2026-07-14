# PLP Metadata Generator

Generates [bulk metadata](https://www.aem.live/docs/bulk-metadata) for category (PLP) pages so Edge Delivery can serve **per-category title, description, and ItemList JSON-LD in View Source** without JavaScript.

> **Important:** [AEM Commerce Prerender](https://experienceleague.adobe.com/developer/commerce/storefront/setup/configuration/aem-prerender/) only supports **product detail pages (PDP)** today. Category product grids are still rendered client-side by the `product-list-page` block — even on [aemshop.net](https://www.aemshop.net/apparel). Bulk metadata is the supported SEO approach for PLP.

## What this tool provides

- One `metadata.json` row per category URL (`/categories/{urlPath}/{id}`)
- `title`, `description`, Open Graph tags
- `json-ld` with `ItemList` + `BreadcrumbList` (products linked to PDP URLs)
- `cateId` and `template: plp` metadata fields

## Prerequisites

- Node.js
- Your storefront `config.json` URL with Catalog Service access
- Category URLs using `/categories/{urlPath}/{categoryId}` (this project's pattern)

## Installation

```bash
cd tools/plp-metadata
npm install
```

## Configuration

Set environment variables before running (optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `STORE_URL` | `https://main--bvi-acs--ajay0641.aem.live` | Public site URL |
| `CONFIG_URL` | `{STORE_URL}/config.json` | Storefront config |
| `ROOT_CATEGORY_ID` | `2` | Root category for the category tree |
| `JSON_LD_PRODUCT_LIMIT` | `8` | Max products in ItemList schema |

## Run

```bash
npm start
```

Outputs:

- `category-metadata.xlsx`
- `category-metadata.json`

## Merge with PDP metadata

Generate product metadata first, then merge:

```bash
cd tools/pdp-metadata && npm install && npm start
cd ../plp-metadata && npm install && npm start
cd .. && node merge-metadata.js
```

Upload the merged `tools/metadata.json` to your da.live site root and publish.

## Upload to da.live

```bash
curl -X POST \
  'https://admin.da.live/source/{org}/{site}/metadata.json' \
  --header 'Authorization: Bearer <your-IMS-JWT>' \
  --form 'data=@../pdp-metadata/metadata.json'
```

## da.live `categories/default` page

Keep the template metadata block minimal:

| Field | Value |
|-------|-------|
| `breadcrumb` | `auto` |
| `template` | `plp` |

Do **not** put category-specific `json-ld` on the template — use bulk metadata instead.

Set the `product-list-page` block:

| Field | Example |
|-------|---------|
| `urlpath` | `apparel` |

## Full product HTML in View Source (PDP only)

For product **card HTML** in category View Source, Adobe does not ship a PLP prerender solution. Options:

1. **Bulk metadata (this tool)** — SEO meta + ItemList JSON-LD in source (recommended)
2. **[aem-commerce-prerender](https://github.com/adobe-rnd/aem-commerce-prerender)** — PDP HTML only; deploy separately via App Builder
3. **Custom App Builder extension** — extend prerender for PLP (not in Adobe boilerplate)

## Verify

```bash
curl -s "https://{branch}--{repo}--{owner}.aem.page/categories/apparel/2" | grep -E 'application/ld\+json|<meta name="description"'
```
