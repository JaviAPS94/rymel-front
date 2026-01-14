import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  Design,
  DesignFunctionEvaluation,
  DesignFunctionEvaluationResponse,
  DesignsPaginated,
  DesignsPaginatedParams,
  DesignSubtype,
  DesignType,
  DesignWithSubDesigns,
  Template,
  UpdateDesignParams,
} from "../../commons/types";
import { TemplateType } from "../../commons/enums";

const designApi = createApi({
  reducerPath: "designApi",
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
  tagTypes: ["Design"],
  endpoints: (builder) => ({
    getDesignTypes: builder.query<DesignType[], void>({
      query: () => "/design/types",
      providesTags: ["Design"],
    }),
    getDesignSubtypesByTypeId: builder.query<DesignSubtype[], number>({
      query: (typeId) => `/design/subtypes/by-type/${typeId}`,
      providesTags: ["Design"],
    }),
    getDesignSubtypeWithFunctionsById: builder.query<DesignSubtype, number>({
      query: (subTypeId) => `/design/subtypes/${subTypeId}/with-functions`,
      providesTags: ["Design"],
    }),
    evaluateFunction: builder.mutation<
      DesignFunctionEvaluationResponse,
      DesignFunctionEvaluation
    >({
      query: (evaluationData) => ({
        url: "/design-functions/calculate",
        method: "POST",
        body: evaluationData,
      }),
    }),
    getTemplatesByDesignSubtypeId: builder.query<
      Template[],
      { designSubtypeId: number; type?: TemplateType }
    >({
      query: ({ designSubtypeId, type = TemplateType.DESIGN }) =>
        `/design/templates/${designSubtypeId}?type=${type}`,
    }),
    saveDesignWithSubDesigns: builder.mutation<
      { id: number },
      DesignWithSubDesigns
    >({
      query: (designData) => ({
        url: "/design",
        method: "POST",
        body: designData,
      }),
    }),
    getDesignsByFiltersPaginated: builder.mutation<
      DesignsPaginated,
      DesignsPaginatedParams
    >({
      query: (getDesignsParams) => ({
        url: "/design/by-filters-paginated",
        method: "POST",
        body: getDesignsParams,
      }),
    }),
    getDesignById: builder.query<Design, number>({
      query: (designId) => `/design/by-id/${designId}`,
    }),
    update: builder.mutation<void, UpdateDesignParams>({
      query: (updateDesignParams) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...bodyData } = updateDesignParams;
        return {
          url: `/design/${updateDesignParams.id}`,
          method: "PUT",
          body: bodyData,
        };
      },
      invalidatesTags: ["Design"],
    }),
    deleteById: builder.mutation<void, number>({
      query: (designId) => ({
        url: `/design/${designId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Design"],
    }),
  }),
});

export const {
  useGetDesignTypesQuery,
  useGetDesignSubtypesByTypeIdQuery,
  useLazyGetDesignSubtypeWithFunctionsByIdQuery,
  useEvaluateFunctionMutation,
  useLazyGetTemplatesByDesignSubtypeIdQuery,
  useSaveDesignWithSubDesignsMutation,
  useGetDesignsByFiltersPaginatedMutation,
  useLazyGetDesignByIdQuery,
  useGetDesignByIdQuery,
  useUpdateMutation,
  useDeleteByIdMutation,
} = designApi;
export { designApi };
