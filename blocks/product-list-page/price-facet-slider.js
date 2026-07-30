import { search } from '@dropins/storefront-product-discovery/api.js';
import { events } from '@dropins/tools/event-bus.js';

/**
 * @typedef {object} SearchFacet
 * @property {string} title
 * @property {string} attribute
 * @property {Array<object>} buckets
 */

/**
 * @typedef {object} PriceFacetSliderOptions
 * @property {boolean} [autoApply=true] When false, slider only updates UI / onChange
 * @property {(range: { from: number, to: number|null }) => void} [onChange]
 * @property {string} [currency='USD']
 */

let lastSearchRequest = null;

events.on('search/result', (payload) => {
  if (payload?.request) {
    lastSearchRequest = payload.request;
  }
}, { eager: true });

/**
 * @param {string} currency
 * @returns {Intl.NumberFormat}
 */
function createPriceFormatter(currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
    });
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  }
}

/**
 * Parses numeric bounds from price facet buckets (RangeBucket).
 * @param {SearchFacet} facet
 * @returns {{ min: number, max: number, openEndedMax: boolean }}
 */
function getPriceBounds(facet) {
  const ranges = facet.buckets.map((bucket) => {
    const from = bucket.from ?? parseFloat(String(bucket.title).split('-')[0]);
    const titleParts = String(bucket.title).split('-');
    const toRaw = bucket.to ?? titleParts[1];
    const to = toRaw === '*' || toRaw === undefined || toRaw === ''
      ? null
      : Number(toRaw);
    return {
      from: Number.isFinite(from) ? from : 0,
      to: Number.isFinite(to) ? to : null,
    };
  });

  const min = Math.min(...ranges.map((r) => r.from));
  const last = ranges[ranges.length - 1];
  const openEndedMax = last?.to == null;
  const max = openEndedMax
    ? last.from
    : Math.max(...ranges.map((r) => (r.to != null ? r.to : r.from)));

  return { min, max, openEndedMax };
}

/**
 * Resolves the active price range from the current search request or facet selection.
 * @param {SearchFacet} facet
 * @param {number} boundMin
 * @param {number} boundMax
 * @returns {{ from: number, to: number }}
 */
function getInitialRange(facet, boundMin, boundMax) {
  const requestRange = lastSearchRequest?.filter?.find((f) => f.attribute === 'price')?.range;
  if (requestRange && Number.isFinite(requestRange.from) && Number.isFinite(requestRange.to)) {
    return {
      from: Math.max(boundMin, requestRange.from),
      to: Math.min(boundMax, requestRange.to),
    };
  }

  const selected = facet.buckets.find((b) => b.selected);
  if (selected) {
    const from = selected.from ?? parseFloat(String(selected.title).split('-')[0]);
    const parts = String(selected.title).split('-');
    const toRaw = selected.to ?? parts[1];
    const to = toRaw === '*' ? boundMax : Number(toRaw);
    if (Number.isFinite(from) && Number.isFinite(to)) {
      return { from: Math.max(boundMin, from), to: Math.min(boundMax, to) };
    }
    if (Number.isFinite(from) && toRaw === '*') {
      return { from: Math.max(boundMin, from), to: boundMax };
    }
  }

  return { from: boundMin, to: boundMax };
}

/**
 * Builds a price range slider facet to replace default price radio buckets.
 * @param {SearchFacet} facet
 * @param {PriceFacetSliderOptions|string} [optionsOrCurrency]
 * @returns {HTMLElement}
 */
export function createPriceFacetSlider(facet, optionsOrCurrency = {}) {
  const options = typeof optionsOrCurrency === 'string'
    ? { currency: optionsOrCurrency }
    : (optionsOrCurrency || {});
  const autoApply = options.autoApply !== false;
  const { onChange } = options;
  const currency = options.currency || 'USD';

  const { min: boundMin, max: boundMax, openEndedMax } = getPriceBounds(facet);
  const step = 1;
  let { from, to } = getInitialRange(facet, boundMin, boundMax);

  const root = document.createElement('div');
  root.className = 'product-list-page-price-facet product-discovery-facet';
  root.dataset.attribute = facet.attribute;

  const header = document.createElement('span');
  header.className = 'product-discovery-facet__header';
  header.textContent = facet.title;

  const values = document.createElement('div');
  values.className = 'product-list-page-price-facet__values';
  values.setAttribute('aria-live', 'polite');

  const sliderWrap = document.createElement('div');
  sliderWrap.className = 'product-list-page-price-facet__slider';

  const track = document.createElement('div');
  track.className = 'product-list-page-price-facet__track';
  const trackFill = document.createElement('div');
  trackFill.className = 'product-list-page-price-facet__track-fill';

  const minInput = document.createElement('input');
  minInput.type = 'range';
  minInput.className = 'product-list-page-price-facet__range product-list-page-price-facet__range--min';
  minInput.min = String(boundMin);
  minInput.max = String(boundMax);
  minInput.step = String(step);
  minInput.value = String(from);
  minInput.setAttribute('aria-label', `${facet.title} minimum`);

  const maxInput = document.createElement('input');
  maxInput.type = 'range';
  maxInput.className = 'product-list-page-price-facet__range product-list-page-price-facet__range--max';
  maxInput.min = String(boundMin);
  maxInput.max = String(boundMax);
  maxInput.step = String(step);
  maxInput.value = String(to);
  maxInput.setAttribute('aria-label', `${facet.title} maximum`);

  track.append(trackFill, minInput, maxInput);
  sliderWrap.appendChild(track);

  root.append(header, values, sliderWrap);

  let debounceId;
  let currencyCode = currency;
  let formatPrice = createPriceFormatter(currencyCode);

  const filterToApiMax = (maxValue) => {
    if (openEndedMax && maxValue >= boundMax) {
      return boundMax * 10;
    }
    return maxValue;
  };

  const isFullRange = (minValue, maxValue) => minValue <= boundMin
    && maxValue >= boundMax;

  const getPendingRange = () => {
    const minVal = Number(minInput.value);
    const maxVal = Number(maxInput.value);
    if (isFullRange(minVal, maxVal)) {
      return null;
    }
    return { from: minVal, to: filterToApiMax(maxVal) };
  };

  const updateDisplay = () => {
    const minVal = Number(minInput.value);
    const maxVal = Number(maxInput.value);
    const pctMin = ((minVal - boundMin) / (boundMax - boundMin)) * 100;
    const pctMax = ((maxVal - boundMin) / (boundMax - boundMin)) * 100;
    trackFill.style.left = `${pctMin}%`;
    trackFill.style.width = `${Math.max(0, pctMax - pctMin)}%`;

    const maxLabel = openEndedMax && maxVal >= boundMax
      ? `${formatPrice.format(maxVal)}+`
      : formatPrice.format(maxVal);
    values.textContent = `${formatPrice.format(minVal)} – ${maxLabel}`;
  };

  const applyFilter = () => {
    if (!lastSearchRequest) return;

    const range = getPendingRange();
    const otherFilters = lastSearchRequest.filter.filter((f) => f.attribute !== 'price');
    const filter = range
      ? [...otherFilters, { attribute: 'price', range }]
      : otherFilters;

    search({
      ...lastSearchRequest,
      currentPage: 1,
      filter,
    }).catch(() => {
      // eslint-disable-next-line no-console
      console.error('Price facet filter failed');
    });
  };

  const scheduleFilter = () => {
    clearTimeout(debounceId);
    debounceId = setTimeout(applyFilter, 300);
  };

  const emitChange = () => {
    if (typeof onChange === 'function') {
      onChange(getPendingRange());
    }
  };

  const syncInputs = (source) => {
    let minVal = Number(minInput.value);
    let maxVal = Number(maxInput.value);

    if (minVal > maxVal) {
      if (source === minInput) {
        maxVal = minVal;
        maxInput.value = String(maxVal);
      } else {
        minVal = maxVal;
        minInput.value = String(minVal);
      }
    }

    from = minVal;
    to = maxVal;
    updateDisplay();
    emitChange();
    if (autoApply) {
      scheduleFilter();
    }
  };

  minInput.addEventListener('input', () => syncInputs(minInput));
  maxInput.addEventListener('input', () => syncInputs(maxInput));

  root.dataset.boundMin = String(boundMin);
  root.dataset.boundMax = String(boundMax);
  root.dataset.openEndedMax = openEndedMax ? 'true' : 'false';
  root.dataset.autoApply = autoApply ? 'true' : 'false';

  /**
   * @returns {{ from: number, to: number }|null}
   */
  root.getPendingPriceRange = getPendingRange;

  /**
   * @param {{ from?: number, to?: number }|null} range
   */
  root.setPriceRange = (range) => {
    if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) {
      minInput.value = String(boundMin);
      maxInput.value = String(boundMax);
      updateDisplay();
      return;
    }
    minInput.value = String(Math.max(boundMin, range.from));
    const displayMax = openEndedMax && range.to > boundMax
      ? boundMax
      : Math.min(boundMax, range.to);
    maxInput.value = String(Number.isFinite(displayMax) ? displayMax : boundMax);
    updateDisplay();
  };

  root.syncPriceFacetFromSearch = (payload) => {
    const items = payload?.result?.items || [];
    const itemCurrency = items[0]?.price?.regular?.amount?.currency
      || items[0]?.priceRange?.minimum?.regular?.amount?.currency;
    if (itemCurrency && itemCurrency !== currencyCode) {
      currencyCode = itemCurrency;
      formatPrice = createPriceFormatter(currencyCode);
    }

    const priceFilter = payload?.request?.filter?.find((f) => f.attribute === 'price');
    if (!priceFilter?.range) {
      minInput.value = String(boundMin);
      maxInput.value = String(boundMax);
      updateDisplay();
      return;
    }
    minInput.value = String(Math.max(boundMin, priceFilter.range.from));
    const apiMax = priceFilter.range.to;
    const displayMax = openEndedMax && apiMax > boundMax ? boundMax : Math.min(boundMax, apiMax);
    maxInput.value = String(Number.isFinite(displayMax) ? displayMax : boundMax);
    updateDisplay();
  };

  updateDisplay();

  return root;
}

events.on('search/result', (payload) => {
  document.querySelectorAll('.product-list-page-price-facet').forEach((el) => {
    // Deferred (button-apply) sliders are synced by the deferred panel instead.
    if (el.dataset.autoApply === 'false') return;
    if (typeof el.syncPriceFacetFromSearch === 'function') {
      el.syncPriceFacetFromSearch(payload);
    }
  });
});

/**
 * @param {SearchFacet} facet
 * @returns {boolean}
 */
export function isPriceRangeFacet(facet) {
  return facet.attribute === 'price'
    && facet.buckets.length > 0
    && facet.buckets[0].__typename === 'RangeBucket';
}
