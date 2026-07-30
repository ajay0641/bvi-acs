/**
 * PLP facet apply mode.
 *
 * Flip this constant to switch behavior globally:
 * - 'instant' → filters apply as soon as an option is selected (drop-in default)
 * - 'button'  → selections are staged; click Apply to run the search
 *
 * Optional block config override: `Apply Mode` / `applymode` = instant|button
 */
export const DEFAULT_FACET_APPLY_MODE = 'button';

/**
 * @param {Record<string, string>} [blockConfig]
 * @returns {'instant'|'button'}
 */
export function resolveFacetApplyMode(blockConfig = {}) {
  const fromConfig = String(blockConfig.applymode || '').trim().toLowerCase();
  if (fromConfig === 'instant' || fromConfig === 'button') {
    return fromConfig;
  }
  return DEFAULT_FACET_APPLY_MODE;
}

/**
 * @param {'instant'|'button'} mode
 * @returns {boolean}
 */
export function isButtonApplyMode(mode) {
  return mode === 'button';
}
