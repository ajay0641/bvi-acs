# Storename Dropin Block

The **Storename Dropin** block integrates a custom AEM commerce dropin (`storename-dropin`) into an Edge Delivery Services page. It bootstraps the dropin's GraphQL endpoint and renders the `TestContainer` component from the local dropin package.

## Authored Structure

The block accepts a single optional row with one cell specifying the dropin **variant** to use. If omitted, `default` is used.

| Storename Dropin |
|------------------|
| `variant`        |

**Example:**

| Storename Dropin |
|------------------|
| default          |

## Files

| File | Purpose |
|------|---------|
| `storename-dropin.js` | Block decoration — reads variant, clears markup, renders `TestContainer` |
| `storename-dropin.css` | Scoped styles for the dropin container and its inner components |
| `_storename-dropin.json` | Universal Editor block model definition |

## How It Works

1. **Initialization** — `scripts/initializers/storename-dropin.js` is imported as a side-effect. It sets the GraphQL endpoint (`CORE_FETCH_GRAPHQL`) and mounts the dropin via `initializers.mountImmediately`.
2. **Variant extraction** — the `decorate` function reads the text content from the first authored cell (e.g. `"default"`).
3. **Render** — the block's authored HTML is replaced with the dropin's `TestContainer`, passing the extracted `variant` as a prop.

## Dependencies

- `scripts/__dropins__/storename-dropin/` — local custom dropin package
- `scripts/initializers/storename-dropin.js` — dropin initializer (handles `setEndpoint` + `initialize`)
- `@dropins/tools/initializer.js` — Adobe dropin tools

## Block Model (`_storename-dropin.json`)

- **Block ID:** `storename-dropin`
- **Layout:** 1 row × 2 columns (Universal Editor / Document Authoring)
- No required fields; the variant cell is optional

## Styling Notes

Styles are scoped to `.storename-dropin` and target the dropin's internal class names:

- `.testdropin-test-container` — flex column, centred layout
- `.testdropin-test-component h2` — headline using `--type-headline-1-font`
- `.testdropin-test-component p` — body text using `--type-body-1-default-font`
- `.testdropin-test-component strong` — strong emphasis using `--type-body-1-strong-font`
