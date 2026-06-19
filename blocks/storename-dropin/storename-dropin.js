import { render as provider } from '../../scripts/__dropins__/storename-dropin/render.js';
import { TestContainer } from '../../scripts/__dropins__/storename-dropin/containers/TestContainer.js';
import * as storenameApi from '../../scripts/__dropins__/storename-dropin/api.js';
import { CORE_FETCH_GRAPHQL } from '../../scripts/commerce.js';

export default async function decorate(block) {
  // console.log('decorating storename-dropin block');

  // Set endpoint and initialize dropin
  storenameApi.setEndpoint(CORE_FETCH_GRAPHQL);
  await storenameApi.initialize();

  block.innerHTML = '';
  await provider.render(TestContainer, {})(block);
}
