/*! Copyright 2026 Adobe
All Rights Reserved. */
import{f as e}from"./fetch-graphql.js";const n=`
  query GetStoreConfig {
    storeConfig {
      store_name
    }
  }
`,s=async()=>{const{data:o,errors:t}=await e(n);if(t!=null&&t.length)throw new Error(t[0].message);return o.storeConfig};export{s as t};
//# sourceMappingURL=testFunction.js.map
