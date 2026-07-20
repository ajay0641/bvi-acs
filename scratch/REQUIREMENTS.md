# FAQ Block — Requirements

## Goal
Create an EDS block that fetches FAQ items from an Adobe App Builder GraphQL API and renders them as an expandable FAQ list. Authors can place the block anywhere on pages via da.live.

## Known Inputs
- **GraphQL endpoint:** `https://edge-sandbox-graph.adobe.io/api/9ecd7a2c-dfa9-4989-a596-8f6e27335271/graphql`
- **Query:**
  ```graphql
  {
    faqs {
      id
      question
      answer
    }
  }
  ```
- **Authoring surface:** da.live (Document Authoring)
- **Existing related block:** `blocks/accordion` (content-authored accordion; does not fetch API data)

## Decisions (defaults applied for implementation)
1. **Authentication** — Publicly readable (verified; no token required)
2. **Endpoint config** — Stored in `config.json` as `faq-endpoint` (site-wide)
3. **UI behavior** — Accordion via `<details>`/`<summary>` (multiple items can be open)
4. **Answer format** — HTML (render with `innerHTML`)
5. **Optional heading** — Yes; authors can set via key-value `Heading` row
6. **Filtering** — Load all FAQs for now
7. **Empty / error states** — Show a simple message inside the block

## Approach
- New `faq` key-value block that:
  1. Fetches FAQs from App Builder GraphQL on decorate
  2. Renders accessible `<details>`/`<summary>` items (aligned with accordion patterns)
  3. Registers DA model via `_faq.json` so authors can insert it from da.live

## Out of Scope
- Managing FAQ content in the App Builder admin (backend)
- Writing to the GraphQL API (mutations)

## Phase Status
## Phase 1: Complete ✅
Date: 2026-07-20T07:54:44Z

## Phase 2: Architectural Plan Presented
Date: 2026-07-20T07:57:00Z
Status: Approved via user request to implement

## Phase 2: Complete ✅
User Approved: Yes
Approval Date: 2026-07-20T07:57:00Z

## Phase 3: Implementation Approach Selected
Approach: Option B (Direct Implementation)
Selection Date: 2026-07-20T07:57:00Z

## Phase 4: Implementation Started
Date: 2026-07-20T07:57:00Z

## Phase 4: Implementation Complete ✅
Date: 2026-07-20T08:02:00Z
Deliverables:
- `blocks/faq/faq.js` — GraphQL fetch + accordion render
- `blocks/faq/faq.css` — scoped accordion styles
- `blocks/faq/_faq.json` — da.live model
- `blocks/faq/README.md` — authoring docs
- `config.json` — `faq-endpoint`
- DA registration in `models/_component-definition.json` and `models/_section.json`
- Local test page: `drafts/agent/faq-test.html`
