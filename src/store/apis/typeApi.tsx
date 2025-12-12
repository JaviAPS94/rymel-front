import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Type } from "../../commons/types";

const typeApi = createApi({
  reducerPath: "typeApi",
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
    getTypesWithFields: builder.query<Type[], null>({
      query: () => ({
        url: "/type",
        method: "GET",
      }),
    }),
  }),
});

export const { useGetTypesWithFieldsQuery } = typeApi;
export { typeApi };
