/**
 * PLP facet apply mode.
 *
 * Modes used in the storefront:
 * - 'instant' → filters apply as soon as an option is selected
 * - 'button'  → selections are staged; click Apply / Clear to run the search
 *
 * Resolution order:
 * 1. URL query `filterApplyMode` / `facetApplyMode` (instant|button|apply) — debug / QA
 * 2. Block config `Apply Mode` / `applymode` (instant|button|apply)
 * 3. Remote filter-config-public API (`filterApplyMode`: instant|apply)
 * 4. DEFAULT_FACET_APPLY_MODE
 *
 * Endpoint: config.json → `filter-config-endpoint` only (no hard-coded Adobe I/O URL).
 */
import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';

/**
 * Fallback only when block config and API are unavailable.
 * Prefer the API value — do not assume admin intent on failure.
 */
export const DEFAULT_FACET_APPLY_MODE = 'instant';

/** In-memory cache so multiple PLP instances share one fetch per page load. */
let cachedModePromise = null;

/**
 * Maps API / author values to internal mode.
 * @param {string} [value]
 * @returns {'instant'|'button'|null}
 */
export function normalizeFacetApplyMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (!mode) return null;
  if (mode === 'instant' || mode === 'instant changes' || mode === 'instant-changes') {
    return 'instant';
  }
  // API / admin “Apply changes”; authors may still use "button"
  if (mode === 'apply' || mode === 'button' || mode === 'apply changes' || mode === 'apply-changes') {
    return 'button';
  }
  return null;
}

/**
 * Reads filterApplyMode from various public API payload shapes.
 * @param {object} data
 * @returns {string|undefined}
 */
function extractFilterApplyMode(data) {
  if (!data || typeof data !== 'object') return undefined;
  return data.filterApplyMode
    ?? data.filter_apply_mode
    ?? data.mode
    ?? data?.data?.filterApplyMode
    ?? data?.body?.filterApplyMode
    ?? data?.contents?.filterApplyMode;
}

/**
 * Optional QA override from the page URL.
 * @returns {'instant'|'button'|null}
 */
function modeFromUrl() {
  try {
    const params = new URL(window.location.href).searchParams;
    return normalizeFacetApplyMode(
      params.get('filterApplyMode') || params.get('facetApplyMode'),
    );
  } catch {
    return null;
  }
}

/**
 * Reads filter-config-endpoint from the same-origin /config.json file.
 * Used when initializeConfig() / sessionStorage still has an older config without the key.
 * @returns {Promise<string>}
 */
async function fetchFilterConfigEndpointFromConfigJson() {
  try {
    const response = await fetch(`${window.location.origin}/config.json`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!response.ok) return '';
    const config = await response.json();
    const url = config?.public?.default?.['filter-config-endpoint'];
    return String(url || '').trim();
  } catch (e) {
    console.warn('Could not load filter-config-endpoint from /config.json', e);
    return '';
  }
}

/**
 * Resolves API URL from storefront config (session/init first, then fresh /config.json).
 * @returns {Promise<string>}
 */
async function getFilterConfigEndpoint() {
  try {
    const fromRuntime = String(getConfigValue('filter-config-endpoint') || '').trim();
    if (fromRuntime) return fromRuntime;
  } catch (e) {
    console.warn('Could not read filter-config-endpoint from runtime config', e);
  }

  // Stale sessionStorage often caches config for ~2h without new keys; re-read file.
  return fetchFilterConfigEndpointFromConfigJson();
}

/**
 * Builds a cache-busted request URL so admin toggles are not stuck on a CDN copy.
 * @param {string} endpoint
 * @returns {string}
 */
function withCacheBust(endpoint) {
  try {
    const requestUrl = new URL(endpoint);
    requestUrl.searchParams.set('_', String(Date.now()));
    return requestUrl.toString();
  } catch {
    const join = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${join}_=${Date.now()}`;
  }
}

/**
 * Parses JSON body; supports a raw string or common proxy envelopes.
 * @param {Response} response
 * @returns {Promise<object|null>}
 */
async function parseFilterConfigResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    // allorigins / similar envelopes: { contents: "{...}" }
    if (typeof data?.contents === 'string') {
      try {
        return JSON.parse(data.contents);
      } catch {
        return data;
      }
    }
    return data;
  } catch {
    console.warn('Filter config API returned non-JSON body', text.slice(0, 200));
    return null;
  }
}

/**
 * Fetches filterApplyMode from the public filter-config API.
 * @param {string} [url]
 * @returns {Promise<'instant'|'button'|null>}
 */
export async function fetchFacetApplyModeFromApi(url) {
  const endpoint = (url && String(url).trim()) || await getFilterConfigEndpoint();
  if (!endpoint) {
    console.warn('filter-config-endpoint is not set in config.json');
    return null;
  }

  const requestUrl = withCacheBust(endpoint);

  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      mode: 'cors',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      console.warn(`Filter config API returned ${response.status} for ${endpoint}`);
      return null;
    }
    const data = await parseFilterConfigResponse(response);
    const raw = extractFilterApplyMode(data);
    const mode = normalizeFacetApplyMode(raw);
    if (!mode) {
      console.warn('Filter config API returned unknown filterApplyMode:', raw, data);
      return null;
    }
    console.info('[PLP] filterApplyMode from API:', raw, '→', mode);
    return mode;
  } catch (e) {
    // Common cause: duplicate Access-Control-Allow-Origin headers (e.g. "*,*") on the
    // Adobe I/O action. Browsers require a single value "*" or one origin.
    console.warn(
      '[PLP] Failed to load filter apply mode from API. '
      + 'If admin is “Apply changes” but PLP stays instant, fix CORS on the action '
      + '(return Access-Control-Allow-Origin only once as "*").',
      e,
    );
    return null;
  }
}

/**
 * Resolves facet apply mode for the PLP (async; call with await).
 * @param {Record<string, string>} [blockConfig]
 * @param {{ endpoint?: string }} [options]
 * @returns {Promise<'instant'|'button'>}
 */
export async function resolveFacetApplyMode(blockConfig = {}, options = {}) {
  const fromUrl = modeFromUrl();
  if (fromUrl) {
    console.info('[PLP] filterApplyMode from URL:', fromUrl);
    return fromUrl;
  }

  const fromBlock = normalizeFacetApplyMode(blockConfig.applymode);
  if (fromBlock) {
    console.info('[PLP] filterApplyMode from block config:', fromBlock);
    return fromBlock;
  }

  if (!cachedModePromise) {
    cachedModePromise = (async () => {
      const endpoint = options.endpoint || await getFilterConfigEndpoint();
      const mode = await fetchFacetApplyModeFromApi(endpoint);
      if (!mode) {
        // Allow a later PLP decorate to retry after a failed fetch.
        cachedModePromise = null;
      }
      return mode;
    })();
  }

  const fromApi = await cachedModePromise;
  const resolved = fromApi || DEFAULT_FACET_APPLY_MODE;
  if (!fromApi) {
    console.warn(
      '[PLP] Using fallback filterApplyMode:',
      resolved,
      '(API unavailable — check filter-config-endpoint in config.json and API CORS)',
    );
  }
  return resolved;
}

/**
 * @param {'instant'|'button'} mode
 * @returns {boolean}
 */
export function isButtonApplyMode(mode) {
  return mode === 'button';
}
