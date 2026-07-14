export default `query categoryProductSearch(
  $phrase: String!
  $pageSize: Int
  $currentPage: Int = 1
  $filter: [SearchClauseInput!]
) {
  productSearch(
    phrase: $phrase
    page_size: $pageSize
    current_page: $currentPage
    filter: $filter
  ) {
    total_count
    items {
      productView {
        sku
        name
        urlKey
        url
        inStock
        images(roles: ["image"]) {
          url
        }
        ... on SimpleProductView {
          price {
            final {
              amount {
                currency
                value
              }
            }
          }
        }
        ... on ComplexProductView {
          priceRange {
            minimum {
              final {
                amount {
                  currency
                  value
                }
              }
            }
          }
        }
      }
    }
    page_info {
      current_page
      page_size
      total_pages
    }
  }
}`;
