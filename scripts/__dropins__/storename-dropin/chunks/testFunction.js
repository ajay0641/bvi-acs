/*! Copyright 2026 Adobe
All Rights Reserved. */
import{FetchGraphQL as a}from"@dropins/tools/fetch-graphql.js";const{setEndpoint:n,setFetchGraphQlHeader:h,removeFetchGraphQlHeader:c,setFetchGraphQlHeaders:g,fetchGraphQl:s,getConfig:i}=new a().getMethods(),r=`
  query GetStoreConfig {
    storeConfig {
      store_name
    }
  }
`,f=async()=>{const{data:t,errors:e}=await s(r);if(e!=null&&e.length)throw new Error(e[0].message);return t.storeConfig};export{h as a,g as b,s as f,i as g,c as r,n as s,f as t};
//# sourceMappingURL=testFunction.js.map
