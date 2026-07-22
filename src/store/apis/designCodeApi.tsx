import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type GenerateDesignCodeParams = {
  elementId: number;
  moValue?: string;
  materialDevanadoValue?: string;
};

export type DesignCodeSegmentKey =
  | "FASE"
  | "POTENCIA"
  | "TENSION_PRIMARIA"
  | "TENSION_SECUNDARIA"
  | "ANIO"
  | "MO"
  | "MATERIAL_DEVANADO"
  | "PAIS"
  | "SUFIJO_FINAL";

export type DesignCodeSegment = {
  key: DesignCodeSegmentKey;
  label: string;
  value: string;
  isMissing: boolean;
};

export type GenerateDesignCodeResponse = {
  code: string;
  isDuplicate: boolean;
  baseCode?: string;
  isComplete: boolean;
  moMissing: boolean;
  materialDevanadoMissing: boolean;
  segments: DesignCodeSegment[];
  /** Pattern of the default disambiguation suffix; only present when isDuplicate is true. */
  suffixPattern?: string;
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
    checkCodeAvailable: builder.query<{ isAvailable: boolean }, string>({
      query: (code) => ({
        url: "/design/code/is-available",
        method: "GET",
        params: { code },
      }),
    }),
  }),
});

export const {
  useGenerateDesignCodeMutation,
  useLazyCheckCodeAvailableQuery,
} = designCodeApi;
export { designCodeApi };
