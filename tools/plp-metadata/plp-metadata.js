import XLSX from 'xlsx';
import fs from 'fs';
import he from 'he';
import categoriesQuery from './queries/categories.graphql.js';
import categoryProductsQuery from './queries/category-products.graphql.js';

// Match pdp-metadata defaults; override with STORE_URL / CONFIG_URL for your site.
const basePath = process.env.STORE_URL || 'https://www.aemshop.net';
const configFile = process.env.CONFIG_URL || `${basePath}/config.json`;
const rootCategoryId = process.env.ROOT_CATEGORY_ID || '2';
const jsonLdProductLimit = parseInt(process.env.JSON_LD_PRODUCT_LIMIT || '8', 10);

function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function mergeStoreConfig(defaultConfig, storeConfig) {
  const mergedConfig = { ...defaultConfig };
  if (storeConfig.headers) {
    mergedConfig.headers = deepMerge(mergedConfig.headers || {}, storeConfig.headers);
  }
  if (storeConfig['commerce-endpoint']) {
    mergedConfig['commerce-endpoint'] = storeConfig['commerce-endpoint'];
  }
  return mergedConfig;
}

function createHashFromObject(obj, length = 5) {
  const objString = Object.entries(obj)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
  return objString
    .split('')
    .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 2147483647, 0)
    .toString(36)
    .slice(0, length);
}

async function commerceEndpointWithQueryParams(config) {
  const urlWithQueryParams = new URL(config['commerce-endpoint']);
  const hash = createHashFromObject(config.headers?.cs ?? {});
  urlWithQueryParams.searchParams.append('cb', hash);
  return urlWithQueryParams;
}

async function performCatalogServiceQuery(config, query, variables) {
  const headers = {
    'Content-Type': 'application/json',
    ...config.headers?.all,
    ...config.headers?.cs,
  };

  const response = await fetch(await commerceEndpointWithQueryParams(config), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: query.replace(/(?:\r\n|\r|\n|\t|[\s]{4})/g, ' ').replace(/\s\s+/g, ' '),
      variables,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`Catalog Service query failed (${response.status}): ${body.slice(0, 500)}`);
    return null;
  }

  const queryResponse = await response.json();
  if (queryResponse.errors?.length) {
    console.error('Catalog Service GraphQL errors:', JSON.stringify(queryResponse.errors).slice(0, 500));
  }
  return queryResponse.data;
}

function stripHtml(value = '') {
  return he.decode(value.replace(/(<([^>]+)>)/ig, '')).trim();
}

function getProductPrice(product) {
  return product.priceRange?.minimum?.final?.amount || product.price?.final?.amount;
}

function getProductPath(product, rootPath) {
  const path = `/products/${product.urlKey}/${product.sku}`.toLowerCase();
  if (rootPath === 'default') return path;
  return `${rootPath.replace(/\/$/, '')}${path}`;
}

function getCategoryPath(category, rootPath) {
  const path = `/categories/${category.urlPath}/${category.id}`;
  if (rootPath === 'default') return path;
  return `${rootPath.replace(/\/$/, '')}${path}`;
}

function getCategoryDescription(category) {
  return `${category.name} category`;
}

function getItemListJsonLd(category, products, totalCount, categoryUrl) {
  const itemListElement = products.map((product, index) => {
    const amount = getProductPrice(product.productView);
    let imageUrl = product.productView.images?.[0]?.url || '';
    if (imageUrl.startsWith('//')) {
      imageUrl = `https:${imageUrl}`;
    }

    const productPath = getProductPath(product.productView, category.rootPath);

    return {
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.productView.name,
        url: `${basePath}${productPath}`,
        image: imageUrl,
        offers: amount?.value ? {
          '@type': 'Offer',
          price: amount.value,
          priceCurrency: amount.currency || 'USD',
          availability: product.productView.inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        } : undefined,
      },
    };
  });

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        '@id': `${categoryUrl}#list`,
        name: category.name,
        description: getCategoryDescription(category),
        url: categoryUrl,
        numberOfItems: totalCount,
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
            item: `${basePath}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: category.name,
            item: categoryUrl,
          },
        ],
      },
    ],
  });
}

async function getCategories(config) {
  const response = await performCatalogServiceQuery(config, categoriesQuery, {
    ids: [rootCategoryId],
    roles: ['active'],
    depth: 10,
    startLevel: 1,
  });

  return (response?.categories || []).filter((category) => category.urlPath);
}

async function getCategoryProducts(config, urlPath, pageNumber = 1, accumulated = []) {
  const response = await performCatalogServiceQuery(config, categoryProductsQuery, {
    phrase: '',
    pageSize: 50,
    currentPage: pageNumber,
    filter: [
      { attribute: 'categoryPath', eq: urlPath },
      { attribute: 'visibility', in: ['Search', 'Catalog, Search'] },
    ],
  });

  if (!response?.productSearch) {
    return { products: accumulated, totalCount: 0 };
  }

  const items = response.productSearch.items || [];
  const allProducts = [...accumulated, ...items];
  const { current_page: currentPage, total_pages: totalPages } = response.productSearch.page_info;

  if (currentPage < totalPages) {
    return getCategoryProducts(config, urlPath, currentPage + 1, allProducts);
  }

  return {
    products: allProducts,
    totalCount: response.productSearch.total_count || allProducts.length,
  };
}

async function buildCategoryMetadata(category, config, rootPath) {
  const { products, totalCount } = await getCategoryProducts(config, category.urlPath);
  if (totalCount === 0) {
    return null;
  }

  const categoryWithRoot = { ...category, rootPath };
  const path = getCategoryPath(categoryWithRoot, rootPath);
  const title = stripHtml(category.name);
  const description = getCategoryDescription(category);
  const categoryUrl = `${basePath}${path}`;
  const jsonLdProducts = products.slice(0, jsonLdProductLimit);

  return {
    URL: path,
    title,
    description,
    keywords: '',
    // Keep the same column order as pdp-metadata so DA/Helix does not shift values.
    sku: category.id,
    'og:type': 'website',
    'og:title': title,
    'og:description': description,
    'og:url': categoryUrl,
    'og:image': '',
    'og:image:secure_url': '',
    'last-modified': '',
    'json-ld': getItemListJsonLd(categoryWithRoot, jsonLdProducts, totalCount, categoryUrl),
    // Extra fields (must come after shared PDP columns)
    cateId: category.id,
    template: 'plp',
  };
}

(async () => {
  const configResponse = await fetch(configFile)
    .then((res) => res.json())
    .then((data) => data.public)
    .catch((err) => {
      console.error(err);
      return {};
    });

  const defaultConfig = configResponse.default;
  if (!defaultConfig) {
    console.error('No default configuration found');
    process.exit(1);
  }

  const storeConfigs = Object.entries(configResponse)
    .filter(([key]) => key !== 'default')
    .map(([rootPath, storeConfig]) => ({
      rootPath,
      config: mergeStoreConfig(defaultConfig, storeConfig),
    }));

  const allStores = [
    { rootPath: 'default', config: defaultConfig },
    ...storeConfigs,
  ];

  console.log(`Processing ${allStores.length} stores: ${allStores.map((s) => s.rootPath).join(', ')}`);

  const categoryRows = [];
  for (const store of allStores) {
    console.log(`Fetching categories for store: ${store.rootPath}`);
    const categories = await getCategories(store.config);
    console.log(`Found ${categories.length} categories in store: ${store.rootPath}`);

    for (const category of categories) {
      try {
        const row = await buildCategoryMetadata(category, store.config, store.rootPath);
        if (row) {
          categoryRows.push(row);
          console.log(`Generated metadata for ${row.URL} (${row.title})`);
        }
      } catch (error) {
        console.error(`Failed to generate metadata for category ${category.urlPath}:`, error);
      }
    }
  }

  const headers = [
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

  const sheetData = [headers, ...categoryRows.map((row) => headers.map((key) => row[key] || ''))];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = { Sheets: { Sheet1: worksheet }, SheetNames: ['Sheet1'] };
  const xlsx = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  await fs.promises.writeFile('category-metadata.xlsx', xlsx);

  const jsonData = {
    data: {
      total: categoryRows.length,
      limit: categoryRows.length,
      offset: 0,
      data: categoryRows,
      ':colWidths': headers.map(() => 100),
    },
    ':names': ['data'],
    ':version': 3,
    ':type': 'multi-sheet',
  };

  await fs.promises.writeFile('category-metadata.json', JSON.stringify(jsonData, null, 2));
  console.log(`Generated category-metadata.xlsx and category-metadata.json with ${categoryRows.length} categories`);
})();
