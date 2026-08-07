import { search } from '@dropins/storefront-product-discovery/api.js';
import { events } from '@dropins/tools/event-bus.js';

/** Filters that must always stay on the search request. */
export const SYSTEM_FILTER_ATTRIBUTES = new Set(['visibility', 'categoryPath']);

/**
 * @param {number} value
 * @param {string} [currency='USD']
 * @returns {string}
 */
function formatMoney(value, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `$${value}`;
  }
}

/**
 * User-facing filters from a search request (excludes system attributes).
 * @param {Array<object>} [filters]
 * @returns {Array<object>}
 */
export function getUserFilters(filters = []) {
  return filters.filter((f) => f?.attribute && !SYSTEM_FILTER_ATTRIBUTES.has(f.attribute));
}

/**
 * Selected-filter chips + Clear all for PLP (works for continuous price ranges).
 * Use in instant mode with the Facets drop-in, or reuse styles with button-apply panel.
 *
 * @param {object} options
 * @param {() => object|null} options.getLastRequest
 * @param {() => Map<string, string>} [options.getFacetTitles]
 * @param {string} [options.clearAllLabel='Clear all']
 * @returns {HTMLElement & {
 *   updateFromRequest: (request?: object) => void,
 * }}
 */
export function createSelectedFacetChips({
  getLastRequest,
  getFacetTitles,
  clearAllLabel = 'Clear all',
} = {}) {
  const root = document.createElement('div');
  root.className = 'product-list-page-facet-panel__selected';
  root.hidden = true;

  /**
   * @returns {Map<string, string>}
   */
  const titles = () => {
    if (typeof getFacetTitles === 'function') {
      return getFacetTitles() || new Map();
    }
    return new Map();
  };

  /**
   * @param {Array<object>} userFilters
   */
  const runSearchWithUserFilters = (userFilters) => {
    const lastRequest = typeof getLastRequest === 'function' ? getLastRequest() : null;
    if (!lastRequest) return;

    const systemFilters = (lastRequest.filter || [])
      .filter((f) => SYSTEM_FILTER_ATTRIBUTES.has(f.attribute));

    search({
      ...lastRequest,
      currentPage: 1,
      filter: [...systemFilters, ...userFilters],
    }).catch(() => {
      // eslint-disable-next-line no-console
      console.error('Selected facet chip search failed');
    });
  };

  /**
   * @param {string} attribute
   * @param {string} [value]
   */
  const removeFilter = (attribute, value) => {
    const lastRequest = typeof getLastRequest === 'function' ? getLastRequest() : null;
    const current = getUserFilters(lastRequest?.filter);

    const next = current.reduce((acc, filter) => {
      if (filter.attribute !== attribute) {
        acc.push(filter);
        return acc;
      }
      if (filter.range) {
        return acc;
      }
      if (Array.isArray(filter.in)) {
        const remaining = filter.in.filter((v) => v !== value);
        if (remaining.length) {
          acc.push({ attribute, in: remaining });
        }
      } else if (filter.eq && filter.eq !== value) {
        acc.push(filter);
      }
      return acc;
    }, /** @type {Array<object>} */ ([]));

    runSearchWithUserFilters(next);
  };

  const clearAll = () => {
    runSearchWithUserFilters([]);
  };

  /**
   * @param {object} [request]
   */
  const updateFromRequest = (request) => {
    const lastRequest = request
      || (typeof getLastRequest === 'function' ? getLastRequest() : null);
    const userFilters = getUserFilters(lastRequest?.filter);
    root.replaceChildren();

    const chips = [];
    const facetTitles = titles();

    userFilters.forEach((filter) => {
      if (filter.range && Number.isFinite(filter.range.from) && Number.isFinite(filter.range.to)) {
        const label = `${formatMoney(filter.range.from)} – ${formatMoney(filter.range.to)}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'product-list-page-facet-panel__chip';
        btn.setAttribute('aria-label', `Remove price filter: ${label}`);
        btn.innerHTML = `<span>${label}</span><span aria-hidden="true">×</span>`;
        btn.addEventListener('click', () => removeFilter(filter.attribute || 'price'));
        chips.push(btn);
        return;
      }

      let values = [];
      if (Array.isArray(filter.in)) {
        values = filter.in;
      } else if (filter.eq) {
        values = [filter.eq];
      }

      values.forEach((value) => {
        const attrTitle = facetTitles.get(filter.attribute) || filter.attribute;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'product-list-page-facet-panel__chip';
        btn.setAttribute('aria-label', `Remove ${attrTitle} filter: ${value}`);
        btn.innerHTML = `<span>${value}</span><span aria-hidden="true">×</span>`;
        btn.addEventListener('click', () => removeFilter(filter.attribute, value));
        chips.push(btn);
      });
    });

    if (!chips.length) {
      root.hidden = true;
      return;
    }

    chips.forEach((chip) => root.appendChild(chip));

    const clearAllBtn = document.createElement('button');
    clearAllBtn.type = 'button';
    clearAllBtn.className = 'product-list-page-facet-panel__chip product-list-page-facet-panel__chip--clear-all';
    clearAllBtn.textContent = clearAllLabel;
    clearAllBtn.addEventListener('click', clearAll);
    root.appendChild(clearAllBtn);
    root.hidden = false;
  };

  root.updateFromRequest = updateFromRequest;

  events.on('search/result', (payload) => {
    if (payload?.request) {
      updateFromRequest(payload.request);
    }
  }, { eager: true });

  return root;
}
