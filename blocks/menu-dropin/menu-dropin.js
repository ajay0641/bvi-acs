import { render as menuRender } from '../../scripts/__dropins__/menu-dropin/render.js';
import { MenuContainer } from '../../scripts/__dropins__/menu-dropin/containers/MenuContainer.js';

// Initializer handles setEndpoint + initialize via initializers.mountImmediately
import '../../scripts/initializers/menu-dropin.js';

/**
 * Authored block structure:
 * +------------+
 * | variant    |  ← first row, first cell: e.g. "default"
 * +------------+
 * | parentId   |  ← optional second row: root category ID (defaults to "2")
 * +------------+
 */

/**
 * Rewrites menu links from /{urlPath} to /categories/{urlPath}/{categoryId}
 * to match the product URL pattern (/products/{urlKey}/{sku}).
 * Fetches category data from the GraphQL API to get the category ID.
 * @param {Element} block The menu-dropin block element
 * @param {string} parentId The root category ID for fetching categories
 */
async function rewriteMenuLinksWithCategoryId(block, parentId) {
  try {
    // Use the menu's GraphQL endpoint via the initialized CS_FETCH_GRAPHQL
    const { CS_FETCH_GRAPHQL } = await import('../../scripts/commerce.js');

    const query = `
      query GetCategoryIds($ids: [String!]!, $roles: [String!]!, $depth: Int!, $startLevel: Int!) {
        categories(ids: $ids, roles: $roles, subtree: { depth: $depth, startLevel: $startLevel }) {
          id
          urlPath
        }
      }
    `;

    const { data } = await CS_FETCH_GRAPHQL.fetchGraphQl(query, {
      method: 'POST',
      variables: {
        ids: [parentId], roles: ['show_in_menu', 'active'], depth: 3, startLevel: 1,
      },
    });

    if (!data?.categories) return;

    // Build a map of urlPath → id
    const pathToId = new Map();
    data.categories.forEach((cat) => {
      if (cat.urlPath) {
        pathToId.set(cat.urlPath, cat.id);
      }
    });

    // Rewrite links from /{urlPath} to /categories/{urlPath}/{id}
    block.querySelectorAll('a').forEach((link) => {
      try {
        const url = new URL(link.href);
        const { pathname } = url;

        if (url.origin !== window.location.origin) return;
        if (pathname === '/' || pathname === '') return;

        // Extract urlPath from the pathname
        const urlPath = pathname.replace(/^\//, '');
        if (!urlPath) return;

        // Look up the category ID
        const cateId = pathToId.get(urlPath);
        if (cateId) {
          url.pathname = `/categories/${urlPath}/${cateId}`;
          link.href = url.toString();
        }
      } catch {
        // ignore
      }
    });
  } catch (e) {
    // If fetching fails, leave links as-is (they'll still work via folder mapping)
    console.warn('Failed to fetch category IDs for menu links:', e);
  }
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // Row 0: variant (e.g. "default")
  const variant = rows[0]?.querySelector('div')?.textContent?.trim() || 'default';

  // Row 1 (optional): parentId — root category ID for GetCategories query
  const parentId = rows[1]?.querySelector('div')?.textContent?.trim() || '2';

  // Clear authored markup and render the dropin container
  block.innerHTML = '';
  await menuRender.render(MenuContainer, { variant, parentId })(block);

  // The MenuContainer renders menu items asynchronously (uses useEffect to
  // fetch categories), so we need to wait for the links to appear.
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const links = block.querySelectorAll('a');
      if (links.length > 0) {
        observer.disconnect();
        // Rewrite links to include category ID in the URL
        rewriteMenuLinksWithCategoryId(block, parentId).then(resolve).catch(resolve);
      }
    });

    observer.observe(block, { childList: true, subtree: true });

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      rewriteMenuLinksWithCategoryId(block, parentId).then(resolve).catch(resolve);
    }, 5000);
  });
}
