import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { SemiFinishedType } from "../../commons/types";

const semiFinishedApi = createApi({
  reducerPath: "semiFinishedApi",
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
    getSemiFinished: builder.query<SemiFinishedType[], null>({
      query: () => ({
        url: "/semi-finished",
        method: "GET",
      }),
    }),
  }),
});

export const { useGetSemiFinishedQuery } = semiFinishedApi;
export { semiFinishedApi };
