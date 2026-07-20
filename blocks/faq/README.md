# FAQ Block

Fetches FAQ items from an Adobe App Builder GraphQL API and renders them as an accessible accordion. Authors can place this block anywhere in da.live.

## Authored Structure

Key-value config block. Heading is optional.

| FAQ | |
|-----|--|
| Heading | Frequently Asked Questions |

Or drop an empty FAQ block to use defaults (no heading).

## Configuration

| Source | Key | Purpose |
|--------|-----|---------|
| `config.json` → `public.default` | `faq-endpoint` | Site-wide GraphQL endpoint |
| Block row (optional) | `Endpoint` | Override endpoint for this instance |
| Block row (optional) | `Heading` | Title shown above the FAQ list |

## GraphQL Query

```graphql
{
  faqs {
    id
    question
    answer
  }
}
```

Answers are expected as HTML and rendered inside each accordion panel.

## Files

| File | Purpose |
|------|---------|
| `faq.js` | Fetches GraphQL FAQs and builds `<details>` items |
| `faq.css` | Accordion styles scoped to `.faq` |
| `_faq.json` | da.live / Universal Editor model |

## How to Author in da.live

1. Insert the **FAQ** block on any page or fragment.
2. Optionally set **Heading**.
3. Preview / publish — FAQs load from App Builder at runtime.
