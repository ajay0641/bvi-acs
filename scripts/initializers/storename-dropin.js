import { initializers } from '@dropins/tools/initializer.js';
import { initialize, setEndpoint } from '../__dropins__/storename-dropin/api.js';
import { initializeDropin } from './index.js';
import { CORE_FETCH_GRAPHQL } from '../commerce.js';

await initializeDropin(async () => {
  // Set Fetch GraphQL (Core)
  setEndpoint(CORE_FETCH_GRAPHQL);

  // Initialize storename dropin
  return initializers.mountImmediately(initialize, {});
})();
