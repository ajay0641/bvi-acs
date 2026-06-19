import { render as provider } from '../../scripts/__dropins__/storename-dropin/render.js';
import { TestContainer } from '../../scripts/__dropins__/storename-dropin/containers/TestContainer.js';
import * as storenameApi from '../../scripts/__dropins__/storename-dropin/api.js';
import { CORE_FETCH_GRAPHQL } from '../../scripts/commerce.js';

/**
 * Authored block structure:
 * +----------+
 * | variant  |  ← first row, first cell: e.g. "default"
 * +----------+
 */
export default async function decorate(block) {
  // Extract the variant from the first authored cell (row 0, col 0)
  const variant = block.querySelector(':scope > div > div p')?.textContent?.trim() || 'default';

  // Set endpoint and initialize dropin
  storenameApi.setEndpoint(CORE_FETCH_GRAPHQL);
  await storenameApi.initialize();

  // Clear authored markup and render the dropin container
  block.innerHTML = '';
  await provider.render(TestContainer, { variant })(block);
}
