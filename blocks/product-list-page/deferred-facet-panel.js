import { search } from '@dropins/storefront-product-discovery/api.js';
import { events } from '@dropins/tools/event-bus.js';
import { createPriceFacetSlider, isPriceRangeFacet } from './price-facet-slider.js';

/** Filters that must always stay on the search request. */
const SYSTEM_FILTER_ATTRIBUTES = new Set(['visibility', 'categoryPath']);

/**
 * @typedef {object} SearchFacet
 * @property {string} title
 * @property {string} attribute
 * @property {Array<object>} buckets
 */

/**
 * @param {Array<object>} filter
 * @returns {Map<string, Set<string>>}
 */
function scalarSelectionsFromFilter(filter = []) {
  const map = new Map();
  filter.forEach((f) => {
    if (SYSTEM_FILTER_ATTRIBUTES.has(f.attribute) || f.attribute === 'price') return;
    if (Array.isArray(f.in)) {
      map.set(f.attribute, new Set(f.in));
    } else if (f.eq) {
      map.set(f.attribute, new Set([f.eq]));
    }
  });
  return map;
}

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
 * Builds a deferred facet panel: selections stage locally until Apply.
 * @param {object} options
 * @param {() => object|null} options.getLastRequest
 * @param {string} [options.applyLabel='Apply']
 * @param {string} [options.clearLabel='Clear']
 * @param {string} [options.clearAllLabel='Clear all']
 * @returns {HTMLElement & {
 *   updateFacets: (facets: SearchFacet[]) => void,
 *   syncFromRequest: (request: object) => void,
 * }}
 */
export function createDeferredFacetPanel({
  getLastRequest,
  applyLabel = 'Apply',
  clearLabel = 'Clear',
  clearAllLabel = 'Clear all',
} = {}) {
  /** @type {Map<string, Set<string>>} */
  let pendingScalar = new Map();
  /** @type {{ from: number, to: number }|null} */
  let pendingPrice = null;
  let dirty = false;
  /** @type {HTMLElement|null} */
  let priceSlider = null;
  /** @type {Map<string, string>} */
  let facetTitles = new Map();
  /** @type {Array<object>} */
  let appliedFilters = [];

  const root = document.createElement('div');
  root.className = 'product-list-page-facet-panel';

  const selectedWrap = document.createElement('div');
  selectedWrap.className = 'product-list-page-facet-panel__selected';
  selectedWrap.hidden = true;

  const list = document.createElement('div');
  list.className = 'product-list-page-facet-panel__list';

  const actions = document.createElement('div');
  actions.className = 'product-list-page-facet-panel__actions';

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'product-list-page-facet-panel__apply';
  applyBtn.textContent = applyLabel;

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'product-list-page-facet-panel__clear';
  clearBtn.textContent = clearLabel;

  actions.append(clearBtn, applyBtn);
  root.append(selectedWrap, list, actions);

  const markDirty = () => {
    dirty = true;
    applyBtn.disabled = false;
  };

  const markClean = () => {
    dirty = false;
    applyBtn.disabled = true;
  };

  const buildUserFilters = () => {
    /** @type {Array<object>} */
    const filters = [];
    pendingScalar.forEach((values, attribute) => {
      if (values.size > 0) {
        filters.push({ attribute, in: [...values] });
      }
    });
    if (pendingPrice) {
      filters.push({ attribute: 'price', range: { ...pendingPrice } });
    }
    return filters;
  };

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
      console.error('Deferred facet apply failed');
    });
  };

  const applyPending = () => {
    runSearchWithUserFilters(buildUserFilters());
    markClean();
  };

  const clearPending = () => {
    pendingScalar = new Map();
    pendingPrice = null;
    list.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      // eslint-disable-next-line no-param-reassign
      input.checked = false;
    });
    if (priceSlider && typeof priceSlider.setPriceRange === 'function') {
      priceSlider.setPriceRange(null);
    }
    markDirty();
  };

  /**
   * Remove one applied filter value and search immediately.
   * @param {string} attribute
   * @param {string} [value]
   */
  const removeAppliedFilter = (attribute, value) => {
    const next = appliedFilters.reduce((acc, filter) => {
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
      }
      return acc;
    }, /** @type {Array<object>} */ ([]));

    pendingScalar = scalarSelectionsFromFilter(next);
    const priceFilter = next.find((f) => f.attribute === 'price');
    pendingPrice = priceFilter?.range ? { ...priceFilter.range } : null;
    if (priceSlider && typeof priceSlider.setPriceRange === 'function') {
      priceSlider.setPriceRange(pendingPrice);
    }
    list.querySelectorAll('.product-discovery-facet').forEach((section) => {
      const { attribute: attr } = section.dataset;
      if (!attr || attr === 'price') return;
      const selected = pendingScalar.get(attr) || new Set();
      section.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        // eslint-disable-next-line no-param-reassign
        input.checked = selected.has(input.value);
      });
    });

    runSearchWithUserFilters(next);
    markClean();
  };

  const clearAllApplied = () => {
    pendingScalar = new Map();
    pendingPrice = null;
    list.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      // eslint-disable-next-line no-param-reassign
      input.checked = false;
    });
    if (priceSlider && typeof priceSlider.setPriceRange === 'function') {
      priceSlider.setPriceRange(null);
    }
    runSearchWithUserFilters([]);
    markClean();
  };

  /**
   * Render chips for currently applied (committed) filters.
   * @param {Array<object>} [filters]
   */
  const renderSelectedChips = (filters = appliedFilters) => {
    selectedWrap.replaceChildren();
    const chips = [];

    filters.forEach((filter) => {
      if (SYSTEM_FILTER_ATTRIBUTES.has(filter.attribute)) return;

      if (filter.range) {
        const label = `${formatMoney(filter.range.from)} – ${formatMoney(filter.range.to)}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'product-list-page-facet-panel__chip';
        btn.setAttribute('aria-label', `Remove price filter: ${label}`);
        btn.innerHTML = `<span>${label}</span><span aria-hidden="true">×</span>`;
        btn.addEventListener('click', () => removeAppliedFilter('price'));
        chips.push(btn);
        return;
      }

      (filter.in || []).forEach((value) => {
        const attrTitle = facetTitles.get(filter.attribute) || filter.attribute;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'product-list-page-facet-panel__chip';
        btn.setAttribute('aria-label', `Remove ${attrTitle} filter: ${value}`);
        btn.innerHTML = `<span>${value}</span><span aria-hidden="true">×</span>`;
        btn.addEventListener('click', () => removeAppliedFilter(filter.attribute, value));
        chips.push(btn);
      });
    });

    if (!chips.length) {
      selectedWrap.hidden = true;
      return;
    }

    chips.forEach((chip) => selectedWrap.appendChild(chip));

    const clearAllBtn = document.createElement('button');
    clearAllBtn.type = 'button';
    clearAllBtn.className = 'product-list-page-facet-panel__chip product-list-page-facet-panel__chip--clear-all';
    clearAllBtn.textContent = clearAllLabel;
    clearAllBtn.addEventListener('click', clearAllApplied);
    selectedWrap.appendChild(clearAllBtn);
    selectedWrap.hidden = false;
  };

  applyBtn.addEventListener('click', applyPending);
  clearBtn.addEventListener('click', clearPending);

  /**
   * @param {SearchFacet} facet
   * @returns {HTMLElement}
   */
  const renderScalarFacet = (facet) => {
    const section = document.createElement('div');
    section.className = 'product-discovery-facet';
    section.dataset.attribute = facet.attribute;

    const header = document.createElement('span');
    header.className = 'product-discovery-facet__header';
    header.textContent = facet.title;
    section.appendChild(header);

    const selected = pendingScalar.get(facet.attribute) || new Set();

    facet.buckets.forEach((bucket) => {
      const row = document.createElement('div');
      row.className = 'product-discovery-facet__bucket';

      const label = document.createElement('label');
      label.className = 'product-list-page-facet-panel__option';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = `${facet.attribute}-${bucket.title}`;
      input.value = bucket.title;
      input.checked = selected.has(bucket.title);

      const text = document.createElement('span');
      text.textContent = bucket.count != null
        ? `${bucket.title} (${bucket.count})`
        : bucket.title;

      input.addEventListener('change', () => {
        const next = new Set(pendingScalar.get(facet.attribute) || []);
        if (input.checked) {
          next.add(bucket.title);
        } else {
          next.delete(bucket.title);
        }
        if (next.size === 0) {
          pendingScalar.delete(facet.attribute);
        } else {
          pendingScalar.set(facet.attribute, next);
        }
        markDirty();
      });

      label.append(input, text);
      row.appendChild(label);
      section.appendChild(row);
    });

    return section;
  };

  /**
   * Sync pending selections from an applied search request (when not dirty).
   * @param {object} [request]
   */
  const syncFromRequest = (request) => {
    appliedFilters = (request?.filter || [])
      .filter((f) => !SYSTEM_FILTER_ATTRIBUTES.has(f.attribute));
    renderSelectedChips(appliedFilters);

    if (dirty) return;
    pendingScalar = scalarSelectionsFromFilter(request?.filter);
    const priceFilter = request?.filter?.find((f) => f.attribute === 'price');
    pendingPrice = priceFilter?.range
      ? { from: priceFilter.range.from, to: priceFilter.range.to }
      : null;
    if (priceSlider && typeof priceSlider.setPriceRange === 'function') {
      priceSlider.setPriceRange(pendingPrice);
    }
    markClean();
  };

  /**
   * Rebuild facet UI from discovery facet payload.
   * Skips a full rebuild while the shopper has unapplied changes.
   * @param {SearchFacet[]} facets
   */
  const updateFacets = (facets = []) => {
    try {
      facetTitles = new Map(facets.map((f) => [f.attribute, f.title]));
      const lastRequest = typeof getLastRequest === 'function' ? getLastRequest() : null;

      // Always refresh applied chips from the committed request.
      appliedFilters = (lastRequest?.filter || [])
        .filter((f) => !SYSTEM_FILTER_ATTRIBUTES.has(f.attribute));
      renderSelectedChips(appliedFilters);

      // Don't wipe in-progress selections while the shopper is editing.
      if (dirty) {
        applyBtn.disabled = false;
        return;
      }

      syncFromRequest(lastRequest);

      list.innerHTML = '';
      priceSlider = null;

      facets.forEach((facet) => {
        if (!facet?.buckets?.length) return;

        try {
          if (isPriceRangeFacet(facet)) {
            priceSlider = createPriceFacetSlider(facet, {
              autoApply: false,
              onChange: (range) => {
                pendingPrice = range;
                markDirty();
              },
            });
            if (pendingPrice && typeof priceSlider.setPriceRange === 'function') {
              priceSlider.setPriceRange(pendingPrice);
            }
            list.appendChild(priceSlider);
            return;
          }

          list.appendChild(renderScalarFacet(facet));
        } catch (facetError) {
          // eslint-disable-next-line no-console
          console.error(`Failed to render facet "${facet.attribute}"`, facetError);
        }
      });

      applyBtn.disabled = !dirty;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to render deferred facets', e);
    }
  };

  root.updateFacets = updateFacets;
  root.syncFromRequest = syncFromRequest;
  root.applyPending = applyPending;
  root.clearPending = clearPending;

  events.on('search/result', (payload) => {
    if (!payload?.request) return;
    appliedFilters = (payload.request.filter || [])
      .filter((f) => !SYSTEM_FILTER_ATTRIBUTES.has(f.attribute));
    renderSelectedChips(appliedFilters);

    if (dirty) return;
    syncFromRequest(payload.request);
    list.querySelectorAll('.product-discovery-facet').forEach((section) => {
      const { attribute } = section.dataset;
      if (!attribute || attribute === 'price') return;
      const selected = pendingScalar.get(attribute) || new Set();
      section.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        // eslint-disable-next-line no-param-reassign
        input.checked = selected.has(input.value);
      });
    });
  });

  markClean();
  return root;
}
