import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { isRejectedWithValue } from "@reduxjs/toolkit";
import type { Middleware } from "@reduxjs/toolkit";
import { countryApi } from "./apis/countryApi";
import { typeApi } from "./apis/typeApi";
import { normApi } from "./apis/normApi";
import { elementApi } from "./apis/elementApi";
import { subTypeApi } from "./apis/subTypeApi";
import { accesoryApi } from "./apis/accesoryApi";
import { semiFinishedApi } from "./apis/semiFinishedApi";
import { designApi } from "./apis/designApi";
import { authApi } from "./apis/authApi";

let isRedirecting = false;

export const authErrorMiddleware: Middleware = () => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    const status = (action.payload as any)?.status;
    // Check if this is NOT a login endpoint error by checking the meta.arg.endpointName
    const endpointName = (action.meta as any)?.arg?.endpointName;
    const isLoginEndpoint = endpointName === "login";

    console.log("AUTH MIDDLEWARE");
    console.log("status:", status);
    console.log("action.type:", action.type);
    console.log("endpointName:", endpointName);
    console.log("isLoginEndpoint:", isLoginEndpoint);

    if (status === 401 && !isRedirecting && !isLoginEndpoint) {
      isRedirecting = true;

      localStorage.removeItem("access_token");

      const currentPath = window.location.pathname;
      if (currentPath !== "/login") {
        sessionStorage.setItem("redirectAfterLogin", currentPath);
      }

      window.location.href = "/login";

      setTimeout(() => {
        isRedirecting = false;
      }, 1000);
    }
  }

  return next(action);
};

export const store = configureStore({
  reducer: {
    [countryApi.reducerPath]: countryApi.reducer,
    [typeApi.reducerPath]: typeApi.reducer,
    [normApi.reducerPath]: normApi.reducer,
    [elementApi.reducerPath]: elementApi.reducer,
    [subTypeApi.reducerPath]: subTypeApi.reducer,
    [accesoryApi.reducerPath]: accesoryApi.reducer,
    [semiFinishedApi.reducerPath]: semiFinishedApi.reducer,
    [designApi.reducerPath]: designApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(authErrorMiddleware)
      .concat(countryApi.middleware)
      .concat(typeApi.middleware)
      .concat(normApi.middleware)
      .concat(elementApi.middleware)
      .concat(subTypeApi.middleware)
      .concat(accesoryApi.middleware)
      .concat(semiFinishedApi.middleware)
      .concat(designApi.middleware)
      .concat(authApi.middleware),
});

setupListeners(store.dispatch);

export {
  useGetCountriesQuery,
  useLazyGetCountriesQuery,
} from "./apis/countryApi";
export { useGetTypesWithFieldsQuery } from "./apis/typeApi";
export {
  useSaveNormMutation,
  useGetSpecificationsQuery,
  useGetNormsPaginatedQuery,
  useGetNormByIdQuery,
} from "./apis/normApi";
export {
  useGetElementsByFiltersQuery,
  useGetElementsByFiltersPaginatedMutation,
  useGetElementsByIdsQuery,
} from "./apis/elementApi";
export {
  useGetSubTypesWithFieldsByTypeQuery,
  useGetSubTypeByIdQuery,
  useGetAllSubTypesQuery,
} from "./apis/subTypeApi";
export { useGetAccesoriesByNameMutation } from "./apis/accesoryApi";
export { useGetSemiFinishedQuery } from "./apis/semiFinishedApi";
export { subTypeApi } from "./apis/subTypeApi";
export {
  useGetDesignTypesQuery,
  useGetDesignSubtypesByTypeIdQuery,
  useLazyGetDesignSubtypeWithFunctionsByIdQuery,
  useEvaluateFunctionMutation,
  useLazyGetTemplatesByDesignSubtypeIdQuery,
  useSaveDesignWithSubDesignsMutation,
  useGetDesignsByFiltersPaginatedMutation,
  useLazyGetDesignByIdQuery,
  useUpdateMutation,
  useDeleteByIdMutation,
  useGetDesignByIdQuery,
} from "./apis/designApi";
export type AppDispatch = typeof store.dispatch;
