import { render as provider } from '../../scripts/__dropins__/storename-dropin/render.js';
import { TestContainer } from '../../scripts/__dropins__/storename-dropin/containers/TestContainer.js';

// Initializer handles setEndpoint + initialize via initializers.mountImmediately
import '../../scripts/initializers/storename-dropin.js';

/**
 * Authored block structure:
 * +----------+
 * | variant  |  ← first row, first cell: e.g. "default"
 * +----------+
 */
export default async function decorate(block) {
  // Extract the variant from the first authored cell (row 0, col 0)
  const variant = block.querySelector(':scope > div > div p')?.textContent?.trim() || 'default';

  // Clear authored markup and render the dropin container
  block.innerHTML = '';
  await provider.render(TestContainer, { variant })(block);
}
