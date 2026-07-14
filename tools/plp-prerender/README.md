# PLP prerender overlay

Category prerendering is implemented in the sibling App Builder fork:

`../aem-commerce-prerender`

That repository extends [aem-commerce-prerender](https://github.com/adobe-rnd/aem-commerce-prerender) with:

- `category-renderer` — renders `categories/default` into semantic PLP HTML + JSON-LD
- `sync-categories` — discovers categories, hashes markup, publishes overlay paths, cleans up removed categories
- hourly `categorySyncTrigger` in `app.config.yaml`

Do not commit App Builder credentials or `.env` files to this storefront repository.

## Prerequisites

1. Adobe I/O App Builder workspace (Developer role)
2. AEM Helix org admin token for `ajay0641`
3. Catalog Service credentials in published `config.json`
4. Published `categories/default` template with `product-list-page` block

## Verify access

```bash
node tools/plp-prerender/verify-access.js
```

Optional environment overrides:

```bash
AEM_ADMIN_API_AUTH_TOKEN=<token> node tools/plp-prerender/verify-access.js
```

## Deploy overlay (separate repo)

```bash
cd ../aem-commerce-prerender
npm install
npm test
npm run setup
npm run deploy
aio runtime action invoke aem-commerce-ssg/sync-categories \
  --blocking --result \
  --param categoryId 18 \
  --param categoryPath office/office-accessories
```

See `../aem-commerce-prerender/PLP-PRERENDER.md` for the full `.env` template.

## Validate before removing redirect

The storefront keeps the `/categories/default?cp=...` redirect in `scripts/scripts.js` until the direct category URL returns HTTP 200.

```bash
node tools/plp-prerender/validate-overlay.js
node tools/plp-prerender/remove-redirect.js
```

When validation passes, `remove-redirect.js` removes the redirect block automatically.

## Storefront integration

`blocks/product-list-page/product-list-page.js` progressively enhances prerendered markup:

- reads `data-prerendered="true"` from the overlay block
- keeps semantic fallback HTML until Product Discovery loads
- skips client-side `ItemList` JSON-LD when `script[data-name="category-list"]` exists in View Source
