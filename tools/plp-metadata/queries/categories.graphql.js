export default `query GetCategories(
  $ids: [String!]!
  $roles: [String!]!
  $depth: Int!
  $startLevel: Int!
) {
  categories(
    ids: $ids
    roles: $roles
    subtree: { depth: $depth, startLevel: $startLevel }
  ) {
    id
    name
    urlPath
    urlKey
  }
}`;
