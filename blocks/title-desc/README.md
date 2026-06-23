# Title Description Block

The **Title Description** block renders a two-column content pair — a **title** on the left and a **description** on the right. It is a simple, pure-CSS block with no external dependencies.

## Authored Structure

The block expects exactly **one row with two columns**: the first column is the title and the second is the description.

| Title Description |             |
|-------------------|-------------|
| `Title`           | `Description` |

**Example:**

| Title Description        |                                                  |
|--------------------------|--------------------------------------------------|
| Welcome to Our Store     | Discover our wide range of products and services |

## Files

| File | Purpose |
|------|---------|
| `title-desc.js` | Block decoration — applies `title-desc-title` and `title-desc-description` classes to each column |
| `title-desc.css` | Scoped styles for heading and paragraph text |
| `_title-desc.json` | Universal Editor block model with `title` and `description` richtext fields |

## How It Works

The `decorate` function iterates over every row in the block. For rows that have exactly two columns, it adds:

- `title-desc-title` class to the first column (`div:nth-child(1)`)
- `title-desc-description` class to the second column (`div:nth-child(2)`)

This allows CSS to target each column independently without relying on positional selectors.

## Block Model (`_title-desc.json`)

| Field | Component | Type | Required |
|-------|-----------|------|----------|
| `title` | `richtext` | `string` | ✅ Yes |
| `description` | `richtext` | `string` | ✅ Yes |

- **Block ID:** `title-desc`
- **Layout:** 1 row × 2 columns

## Styling Notes

Styles are scoped to `.title-desc`:

- `h1` — bold (`700`), red (`#f00`), bottom margin `20px`
- `p` — `20px` font size, `26px` line height, black (`#000`), bottom margin `20px`
