import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type GenerateDesignCodeParams = {
  elementId: number;
  moValue?: string;
  materialDevanadoValue?: string;
};

export type GenerateDesignCodeResponse = {
  code: string;
  isDuplicate: boolean;
  baseCode?: string;
  isComplete: boolean;
  moMissing: boolean;
  materialDevanadoMissing: boolean;
};

const designCodeApi = createApi({
  reducerPath: "designCodeApi",
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
    generateDesignCode: builder.mutation<
      GenerateDesignCodeResponse,
      GenerateDesignCodeParams
    >({
      query: (params) => ({
        url: "/design/code/generate",
        method: "POST",
        body: params,
      }),
    }),
  }),
});

export const { useGenerateDesignCodeMutation } = designCodeApi;
export { designCodeApi };
