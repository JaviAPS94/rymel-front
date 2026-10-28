import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Cell } from "../../components/design/spreadsheet-types";

/** Ajustes del diseñador a la lista de materiales de un diseño guardado. */
export interface BomAdjustment {
  designId: number;
  bomId: number;
  baseFingerprint: string;
  cells: { [key: string]: Cell };
  expandedNodes: number[];
  updatedBy?: string;
  updatedAt: string;
}

export interface SaveBomAdjustmentRequest {
  designId: number;
  bomId: number;
  baseFingerprint: string;
  cells: { [key: string]: Cell };
  expandedNodes: number[];
}

const bomAdjustmentApi = createApi({
  reducerPath: "bomAdjustmentApi",
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
    // 404 = el diseño no tiene ajustes guardados
    getBomAdjustment: builder.query<BomAdjustment, number>({
      query: (designId) => ({
        url: `/design/${designId}/bom-adjustment`,
        method: "GET",
      }),
    }),
    saveBomAdjustment: builder.mutation<BomAdjustment, SaveBomAdjustmentRequest>({
      query: ({ designId, ...body }) => ({
        url: `/design/${designId}/bom-adjustment`,
        method: "PUT",
        body,
      }),
    }),
    deleteBomAdjustment: builder.mutation<void, number>({
      query: (designId) => ({
        url: `/design/${designId}/bom-adjustment`,
        method: "DELETE",
      }),
    }),
  }),
});

export const {
  useLazyGetBomAdjustmentQuery,
  useSaveBomAdjustmentMutation,
  useDeleteBomAdjustmentMutation,
} = bomAdjustmentApi;
export { bomAdjustmentApi };
