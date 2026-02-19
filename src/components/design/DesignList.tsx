"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Select, { Option } from "../core/Select";
import {
  useGetCountriesQuery,
  useGetDesignsByFiltersPaginatedMutation,
  useGetDesignSubtypesByTypeIdQuery,
  useGetDesignTypesQuery,
} from "../../store";
import CustomInput from "../core/CustomInput";
import Button from "../core/Button";
import { BiEraser, BiSearch } from "react-icons/bi";
import { Design, DesignsPaginated } from "../../commons/types";
import NoData from "../core/NoData";
import Skeleton from "../core/skeletons/Skeleton";
import FilterSkeleton from "../core/skeletons/FiltersSkeleton";
import Pagination from "../core/Pagination";
import { useErrorAlert } from "../../hooks/useAlertError";
import Alert from "../core/Alert";
import DesignCard from "./DesignCard";
import { CiBoxList } from "react-icons/ci";

interface DesignListProps {
  onSelectDesign: (design: Design) => void;
}

export default function DesignList({ onSelectDesign }: DesignListProps) {
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(9);
  const [country, setCountry] = useState<number>();
  const [name, setName] = useState<string>("");
  const [designCode, setDesignCode] = useState<string>("");
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [selectedSubType, setSelectedSubType] = useState<number | null>(null);
  const [designs, setDesigns] = useState<DesignsPaginated>();
  const isInitialLoad = useRef(true);

  const {
    data: countries,
    isLoading: isLoadingCountries,
    error: errorCountries,
  } = useGetCountriesQuery(null);

  useEffect(() => {
    if (countries) {
      setCountry(countries[0]?.id);
    }
  }, [countries]);

  // Fetch design types
  const {
    data: types,
    isLoading: isLoadingTypes,
    error: errorTypes,
  } = useGetDesignTypesQuery();

  // Fetch subtypes when a type is selected
  const {
    data: subTypes,
    isLoading: isLoadingSubTypes,
    error: errorSubTypes,
  } = useGetDesignSubtypesByTypeIdQuery(selectedType || 0, {
    skip: !selectedType,
  });

  const [triggerGetDesignsByFilters, getDesignsResult] =
    useGetDesignsByFiltersPaginatedMutation();

  const { showErrorAlert, errorMessages, setShowErrorAlert } = useErrorAlert({
    "Error obteniendo países": errorCountries,
    "Error obteniendo subtipos": errorSubTypes,
    "Error obteniendo tipos": errorTypes,
    "Error obteniendo diseños": getDesignsResult.error,
  });

  useEffect(() => {
    if (getDesignsResult.isSuccess) {
      setDesigns(getDesignsResult.data);
    }
    if (getDesignsResult.isError) {
      setShowErrorAlert(true);
    }
  }, [getDesignsResult, setShowErrorAlert]);

  const handleCountryChange = (countryId: number | undefined) => {
    setCountry(countryId);
  };

  const handleSelectedType = (typeId: number | undefined) => {
    setSelectedType(typeId || null);
    setSelectedSubType(null);
  };

  const handleSubTypeChange = (subTypeId: number | undefined) => {
    setSelectedSubType(subTypeId || null);
  };

  const handleSearchClick = useCallback(() => {
    setPage(1);
    triggerGetDesignsByFilters({
      page: 1,
      limit,
      name: name || undefined,
      country: country || undefined,
      designTypeId: selectedType || undefined,
      designSubtypeId: selectedSubType || undefined,
      designCode: designCode || undefined,
    });
  }, [
    limit,
    name,
    country,
    selectedType,
    selectedSubType,
    designCode,
    triggerGetDesignsByFilters,
  ]);

  // Trigger search when country is set for the first time
  useEffect(() => {
    if (country && isInitialLoad.current) {
      isInitialLoad.current = false;
      handleSearchClick();
    }
  }, [country, handleSearchClick]);

  const handleCleanFilters = () => {
    setName("");
    setCountry(undefined);
    setSelectedType(null);
    setSelectedSubType(null);
    triggerGetDesignsByFilters({
      page: 1,
      limit,
      name: undefined,
      country: undefined,
      designTypeId: undefined,
      designSubtypeId: undefined,
      designCode: undefined,
    });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    triggerGetDesignsByFilters({
      page: newPage,
      limit,
      name: name || undefined,
      country: country || undefined,
      designTypeId: selectedType || undefined,
      designSubtypeId: selectedSubType || undefined,
      designCode: designCode || undefined,
    });
  };

  return (
    //i want to add a style to this div take all screen
    <div
      className={`max-w-7xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden ${
        !designs?.data || designs.data.length === 0 ? "min-h-screen" : ""
      }`}
    >
      {/* Header */}
      <div className="bg-rymel-blue text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex">
              <CiBoxList className="text-white h-8 w-8" />
              <h1 className="text-3xl font-bold ml-2">Catálogo De Diseños</h1>
            </div>
            <p className="text-white mt-1">
              {designs?.total} diseños disponibles
            </p>
          </div>
          <div className="bg-rymel-yellow px-4 py-2 rounded-lg">
            <span className="text-2xl font-bold">
              {designs?.data.length ?? 0}
            </span>
            <span className="text-white ml-2">filtrados</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex justify-between justify-items-center align-middle min-w-[70rem]">
          {isLoadingCountries || isLoadingSubTypes ? (
            <FilterSkeleton />
          ) : (
            <>
              <Select
                options={countries?.map(
                  (country) =>
                    ({
                      label: country.name,
                      value: country.id,
                    }) as Option<number>,
                )}
                selectedValue={country}
                onChange={handleCountryChange}
                isLoading={false}
                placeholder="País"
                errorKey="country"
              />
              <CustomInput
                type="text"
                value={designCode}
                onChange={setDesignCode}
                placeholder="Código diseño"
              />
              <CustomInput
                type="text"
                value={name}
                onChange={setName}
                placeholder="Nombre norma"
              />
              <Select
                options={types?.map(
                  (type) =>
                    ({
                      label: type.name,
                      value: type.id,
                    }) as Option<number>,
                )}
                selectedValue={selectedType}
                onChange={handleSelectedType}
                isLoading={isLoadingTypes}
                placeholder="Selecciona un tipo"
                className="w-60"
              />
              <Select
                options={subTypes?.map(
                  (subType) =>
                    ({
                      label: subType.name,
                      value: subType.id,
                    }) as Option<number>,
                )}
                selectedValue={selectedSubType}
                onChange={handleSubTypeChange}
                isLoading={isLoadingSubTypes}
                placeholder="Selecciona un sub tipo"
                disabled={!selectedType}
                className="w-60"
              />
              <Button
                primary
                loading={getDesignsResult.isLoading}
                disabled={!country}
                onClick={handleSearchClick}
              >
                <BiSearch />
              </Button>
              <Button
                cancel
                disabled={
                  !country && !name && !selectedType && !selectedSubType
                }
                onClick={handleCleanFilters}
              >
                <BiEraser />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Design Grid */}
      <div className="p-6">
        {getDesignsResult.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 w-full">
            <Skeleton count={10} className="mb-4" />
          </div>
        ) : !designs?.data || designs.data.length === 0 ? (
          <div className="justify-center items-center flex py-12">
            <NoData
              className="w-1/2 bg-gray-400"
              message="No hay resultados para mostrar."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {designs?.data.map((design, index) => (
              <DesignCard
                key={design.id}
                design={design}
                index={index}
                onClick={onSelectDesign}
              />
            ))}
          </div>
        )}
        {designs && designs.data.length > 0 && (
          <div className="flex justify-center align-middle mx-auto mt-4 text-2xl space-x-2">
            <Pagination
              currentPage={page}
              totalPages={designs.totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
      {showErrorAlert && (
        <Alert
          messages={errorMessages}
          error
          onClose={() => setShowErrorAlert(false)}
        />
      )}
    </div>
  );
}
