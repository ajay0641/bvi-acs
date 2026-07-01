/*! Copyright 2026 Adobe
All Rights Reserved. */
import{a as t,f as a}from"./fetch-graphql.js";const o=`
  query GetCategories(
    $ids: [String!]!
    $roles: [String!]!
    $depth: Int!
    $startLevel: Int!
  ) {
    categories(
      ids: $ids
      roles: $roles
      subtree: {
        depth: $depth
        startLevel: $startLevel
      }
    ) {
      id
      name
      level
      urlPath
      urlKey
      parentId
      children
    }
  }
`,n=async(r="2")=>{t("Magento-Store-View-Code","default"),t("Magento-Website-Code","base");const{data:s,errors:e}=await a(o,{variables:{ids:[r],roles:["show_in_menu","active"],depth:3,startLevel:1}});if(e)throw new Error(e[0].message);return s.categories};export{o as G,n as m};
//# sourceMappingURL=menuFunction.js.map
