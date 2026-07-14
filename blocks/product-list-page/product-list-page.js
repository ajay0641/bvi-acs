// Product Discovery Dropins
import SearchResults from '@dropins/storefront-product-discovery/containers/SearchResults.js';
import Facets from '@dropins/storefront-product-discovery/containers/Facets.js';
import SortBy from '@dropins/storefront-product-discovery/containers/SortBy.js';
import Pagination from '@dropins/storefront-product-discovery/containers/Pagination.js';
import { render as provider } from '@dropins/storefront-product-discovery/render.js';
import { Button, Icon, provider as UI } from '@dropins/tools/components.js';
import { search } from '@dropins/storefront-product-discovery/api.js';
// Wishlist Dropin
import { WishlistToggle } from '@dropins/storefront-wishlist/containers/WishlistToggle.js';
import { render as wishlistRender } from '@dropins/storefront-wishlist/render.js';
// Cart Dropin
import * as cartApi from '@dropins/storefront-cart/api.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
// Event Bus
import { events } from '@dropins/tools/event-bus.js';
// AEM
import {
  fetchPlaceholders,
  getProductLink,
  getCategoryFromUrl,
  isCategoryPrerendered,
  isCategoryTemplate,
  IS_DA,
  IS_UE,
  CS_FETCH_GRAPHQL,
  setJsonLd,
} from '../../scripts/commerce.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { getSearchStateFromUrl, applySearchStateToUrl } from './search-url.js';

// Initializers
import '../../scripts/initializers/search.js';
import '../../scripts/initializers/wishlist.js';

/**
 * Builds ItemList + BreadcrumbList JSON-LD from PLP search results when the
 * server-rendered category overlay did not provide schema.
 * @param {object} payload search/result event payload
 * @param {string} categoryPath catalog urlPath
 */
function setCategoryJsonLd(payload, categoryPath) {
  const items = payload?.result?.items || [];
  if (!categoryPath || items.length === 0) return;

  const categoryMeta = getCategoryFromUrl();
  const categoryUrl = categoryMeta
    ? `${window.location.origin}/categories/${categoryMeta.urlPath}/${categoryMeta.cateId}`
    : window.location.href.split('?')[0];
  const categoryName = categoryPath.split('/').pop()?.replace(/-/g, ' ') || categoryPath;

  const itemListElement = items.slice(0, 8).map((product, index) => {
    const amount = product.priceRange?.minimum?.final?.amount || product.price?.final?.amount;
    let imageUrl = product.images?.[0]?.url || '';
    if (imageUrl.startsWith('//')) {
      imageUrl = `https:${imageUrl}`;
    }
    const productUrl = new URL(
      getProductLink(product.urlKey, product.sku),
      window.location.origin,
    ).href;

    return {
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        url: productUrl,
        image: imageUrl || undefined,
        offers: amount?.value != null ? {
          '@type': 'Offer',
          price: amount.value,
          priceCurrency: amount.currency || 'USD',
          availability: product.inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        } : undefined,
      },
    };
  });

  setJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        '@id': `${categoryUrl}#list`,
        name: categoryName,
        url: categoryUrl,
        numberOfItems: payload.result?.totalCount || items.length,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${window.location.origin}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: categoryName,
            item: categoryUrl,
          },
        ],
      },
    ],
  }, 'category-list');

  // Prefer category name in the document title when server metadata did not set one
  if (!isCategoryPrerendered() && !document.querySelector('meta[name="title"]')?.content) {
    document.title = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
  }
}

/**
 * Resolves catalog urlPath for template preview in DA/UE when only defaultCateId is authored.
 * @param {string} categoryId Catalog category ID from block config
 * @returns {Promise<string|null>} Category urlPath or null
 */
async function resolveUrlPathFromCategoryId(categoryId) {
  if (!categoryId) return null;

  const query = `
    query ResolveCategoryUrlPath($ids: [String!]!) {
      categories(ids: $ids, roles: ["active"]) {
        urlPath
      }
    }
  `;

  try {
    const { data } = await CS_FETCH_GRAPHQL.fetchGraphQl(query, {
      method: 'POST',
      variables: { ids: [categoryId] },
    });
    return data?.categories?.[0]?.urlPath || null;
  } catch (e) {
    console.warn('Failed to resolve category urlPath for template preview', e);
    return null;
  }
}

export default async function decorate(block) {
  const labels = await fetchPlaceholders();

  const config = readBlockConfig(block);
  const pageSize = parseInt(config.pagesize, 10) || 9;
  const categoryMeta = getCategoryFromUrl();
  const hasPrerenderedMarkup = block.dataset.prerendered === 'true';
  const hasServerCategoryJsonLd = isCategoryPrerendered();

  // Override the authored urlpath with the actual category path from the URL.
  // This is critical when the block is served via folder mapping
  // (e.g., /categories/default page mapped to /categories/* paths).
  // Without this override, all category pages would show products from the
  // template's authored urlpath instead of the dynamically visited category.
  const urlCategoryPath = categoryMeta?.urlPath
    || block.dataset.categoryUrlPath
    || getCategoryFromUrl()?.urlPath;
  if (urlCategoryPath) {
    config.urlpath = urlCategoryPath;
  } else if (!config.urlpath && config.defaultcateid && isCategoryTemplate() && (IS_UE || IS_DA)) {
    const resolvedPath = await resolveUrlPathFromCategoryId(config.defaultcateid);
    if (resolvedPath) {
      config.urlpath = resolvedPath;
    }
  }

  const fragment = document.createRange().createContextualFragment(`
    <div class="search__wrapper">
      <div class="search__result-info"></div>
      <div class="search__view-facets"></div>
      <div class="search__facets"></div>
      <div class="search__product-sort"></div>
      <div class="search__product-list"></div>
      <div class="search__pagination"></div>
    </div>
  `);

  const $resultInfo = fragment.querySelector('.search__result-info');
  const $viewFacets = fragment.querySelector('.search__view-facets');
  const $facets = fragment.querySelector('.search__facets');
  const $productSort = fragment.querySelector('.search__product-sort');
  const $productList = fragment.querySelector('.search__product-list');
  const $pagination = fragment.querySelector('.search__pagination');
  const $searchWrapper = fragment.querySelector('.search__wrapper');
  const fallbackNodes = hasPrerenderedMarkup ? [...block.childNodes] : [];

  if (hasPrerenderedMarkup) {
    $searchWrapper.hidden = true;
  } else {
    block.innerHTML = '';
  }
  block.appendChild(fragment);

  // Add url path back to the block for enrichment, incase enrichment block is
  // executed after the plp block and block config is not available
  if (config.urlpath) {
    block.dataset.urlpath = config.urlpath;
  }
  if (categoryMeta?.cateId) {
    block.dataset.categoryId = categoryMeta.cateId;
  }

  const searchState = getSearchStateFromUrl(new URL(window.location.href));

  // Default visibility filter for all of our requests
  const visibilityFilter = { attribute: 'visibility', in: ['Search', 'Catalog, Search'] };
  const userFilters = searchState.filter.filter((f) => f.attribute !== 'visibility');

  // Normalize URL (e.g. pipe-separated filter values)
  const normalizedUrl = new URL(window.location.href);
  applySearchStateToUrl(normalizedUrl, searchState);
  window.history.replaceState({}, '', normalizedUrl.toString());

  // Request search based on the page type on block load
  let searchSucceeded = true;
  if (config.urlpath) {
    // If it's a category page...
    await search({
      phrase: '', // search all products in the category
      currentPage: searchState.currentPage,
      pageSize,
      sort: searchState?.sort?.length ? searchState.sort : [{ attribute: 'position', direction: 'DESC' }],
      filter: [
        { attribute: 'categoryPath', eq: config.urlpath }, // category filter
        visibilityFilter,
        ...userFilters,
      ],
    }).catch(() => {
      searchSucceeded = false;
      console.error('Error searching for products');
    });
  } else {
    await search({
      phrase: searchState.phrase,
      currentPage: searchState.currentPage,
      pageSize,
      sort: searchState.sort,
      filter: [visibilityFilter, ...userFilters],
    }).catch((e) => {
      searchSucceeded = false;
      console.error('Error searching for products', e);
    });
  }

  const getAddToCartButton = (product) => {
    if (product.typename === 'ComplexProductView') {
      const button = document.createElement('div');
      UI.render(Button, {
        children: labels.Global?.AddProductToCart,
        icon: Icon({ source: 'Cart' }),
        href: getProductLink(product.urlKey, product.sku),
        variant: 'primary',
      })(button);
      return button;
    }
    const button = document.createElement('div');
    UI.render(Button, {
      children: labels.Global?.AddProductToCart,
      icon: Icon({ source: 'Cart' }),
      onClick: () => cartApi.addProductsToCart([{ sku: product.sku, quantity: 1 }]),
      variant: 'primary',
    })(button);
    return button;
  };

  await Promise.all([
    provider.render(SortBy, {})($productSort),
    provider.render(Pagination, {
      onPageChange: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    })($pagination),
    UI.render(Button, {
      children: labels.Global?.Filters,
      icon: Icon({ source: 'Burger' }),
      variant: 'secondary',
      onClick: () => $facets.classList.toggle('search__facets--visible'),
    })($viewFacets),
    provider.render(Facets, {})($facets),
    provider.render(SearchResults, {
      routeProduct: (product) => getProductLink(product.urlKey, product.sku),
      slots: {
        ProductImage: (ctx) => {
          const { product, defaultImageProps } = ctx;
          const anchorWrapper = document.createElement('a');
          anchorWrapper.href = getProductLink(product.urlKey, product.sku);
          tryRenderAemAssetsImage(ctx, {
            alias: product.sku,
            imageProps: defaultImageProps,
            wrapper: anchorWrapper,
            params: { width: defaultImageProps.width, height: defaultImageProps.height },
          });
        },
        ProductActions: (ctx) => {
          const actionsWrapper = document.createElement('div');
          actionsWrapper.className = 'product-discovery-product-actions';
          const addToCartBtn = getAddToCartButton(ctx.product);
          addToCartBtn.className = 'product-discovery-product-actions__add-to-cart';
          const $wishlistToggle = document.createElement('div');
          $wishlistToggle.classList.add('product-discovery-product-actions__wishlist-toggle');
          wishlistRender.render(WishlistToggle, { product: ctx.product, variant: 'tertiary' })($wishlistToggle);
          actionsWrapper.appendChild(addToCartBtn);
          actionsWrapper.appendChild($wishlistToggle);
          ctx.replaceWith(actionsWrapper);
        },
      },
    })($productList),
  ]);

  // Keep semantic server markup available if Product Discovery fails. Once the
  // interactive containers are ready, replace only the fallback nodes.
  if (hasPrerenderedMarkup && searchSucceeded) {
    fallbackNodes.forEach((node) => node.remove());
    $searchWrapper.hidden = false;
    block.dataset.enhanced = 'true';
  }

  events.on('search/result', (payload) => {
    const totalCount = payload.result?.totalCount || 0;
    block.classList.toggle('product-list-page--empty', totalCount === 0);
    $resultInfo.innerHTML = payload.request?.phrase
      ? `${totalCount} results found for <strong>"${payload.request.phrase}"</strong>.`
      : `${totalCount} results found.`;
    if (payload.request.filter.length > 0) {
      $viewFacets.querySelector('button').setAttribute('data-count', payload.request.filter.length);
    } else {
      $viewFacets.querySelector('button').removeAttribute('data-count');
    }

    if (config.urlpath && !hasServerCategoryJsonLd) {
      setCategoryJsonLd(payload, config.urlpath);
    }
  }, { eager: true });

  events.on('search/result', (payload) => {
    const url = new URL(window.location.href);
    applySearchStateToUrl(url, payload.request);
    window.history.pushState({}, '', url.toString());
  }, { eager: false });

  return Promise.resolve();
}
