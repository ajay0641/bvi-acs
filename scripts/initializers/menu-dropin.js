import { initializers } from '@dropins/tools/initializer.js';
import { initialize, setEndpoint } from '../__dropins__/menu-dropin/api.js';
import { initializeDropin } from './index.js';
import { CORE_FETCH_GRAPHQL } from '../commerce.js';

await initializeDropin(async () => {
  // Set Fetch GraphQL (Core)
  setEndpoint(CORE_FETCH_GRAPHQL);

  // Initialize menu dropin
  return initializers.mountImmediately(initialize, {});
})();
