import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { BomResponse } from "../../commons/types";

const billOfMaterialsApi = createApi({
  reducerPath: "billOfMaterialsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_REACT_APP_API_URL,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem("access_token");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: (builder) => ({
    getBomByCode: builder.query<BomResponse, string>({
      query: (code) => ({
        url: `/bill-of-materials/search?code=${encodeURIComponent(code)}`,
        method: "GET",
      }),
    }),
  }),
});

export const { useLazyGetBomByCodeQuery } = billOfMaterialsApi;
export { billOfMaterialsApi };
