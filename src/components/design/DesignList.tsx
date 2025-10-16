"use client";

import { useEffect, useState } from "react";
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
import CountryFlag from "../core/CountryFlag";
import { useErrorAlert } from "../../hooks/useAlertError";
import Alert from "../core/Alert";

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

  const {
    data: countries,
    isLoading: isLoadingCountries,
    error: errorCountries,
  } = useGetCountriesQuery(null);

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
  }, [getDesignsResult]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // const parseElementValues = (valuesString: string) => {
  //   try {
  //     return JSON.parse(valuesString);
  //   } catch {
  //     return [];
  //   }
  // };

  // const getDesignStats = (design: Design) => {
  //   const totalPhases = design.designElements.reduce((acc, el) => {
  //     const values = parseElementValues(el.element.values);
  //     const phases = values.find((v: any) => v.key === "phases");
  //     return acc + (phases ? Number.parseInt(phases.value) : 0);
  //   }, 0);

  //   const totalPower = design.designElements.reduce((acc, el) => {
  //     const values = parseElementValues(el.element.values);
  //     const power = values.find((v: any) => v.key === "power");
  //     return acc + (power ? Number.parseInt(power.value) : 0);
  //   }, 0);

  //   return { totalPhases, totalPower };
  // };

  const handleCountryChange = (countryId: number | undefined) => {
    setCountry(countryId);
  };

  const handleSelectedType = (typeId: number | undefined) => {
    setSelectedType(typeId || null);
    setSelectedSubType(null); // Reset subtype when type changes
  };

  const handleSubTypeChange = (subTypeId: number | undefined) => {
    setSelectedSubType(subTypeId || null);
  };

  const handleSearchClick = () => {
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
  };

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
            <h1 className="text-3xl font-bold">Catálogo de Diseños</h1>
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
        <div className="flex justify-between justify-items-center align-middle min-w-[70rem] mb-5">
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
                    } as Option<number>)
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
                className="mt-4"
              />
              <CustomInput
                type="text"
                value={name}
                onChange={setName}
                placeholder="Nombre norma"
                className="mt-4"
              />
              <Select
                options={types?.map(
                  (type) =>
                    ({
                      label: type.name,
                      value: type.id,
                    } as Option<number>)
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
                    } as Option<number>)
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
                className="mt-4"
              >
                <BiSearch />
              </Button>
              <Button
                cancel
                disabled={
                  !country && !name && !selectedType && !selectedSubType
                }
                onClick={handleCleanFilters}
                className="mt-4"
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
            {designs?.data.map((design, index) => {
              // const stats = getDesignStats(design);
              return (
                <div
                  key={design.id}
                  onClick={() => onSelectDesign(design)}
                  className="fade-in-up border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-blue-300 group"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    opacity: 0,
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {design.name}
                      </h3>
                      <p className="text-sm text-gray-500 font-mono">
                        {design.code}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                        {design.designSubType?.designType.name}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">
                        {design.designSubType?.name}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-blue-600">
                        {design.designElements.length}
                      </div>
                      <div className="text-xs text-gray-600">Elementos</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-green-600">
                        {design.subDesigns.length}
                      </div>
                      <div className="text-xs text-gray-600">Sub-diseños</div>
                    </div>
                  </div>

                  {/* Technical Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Norma:</span>
                      <span className="font-medium text-orange-600">
                        {design.designElements[0]?.element.norm.name}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">País:</span>
                      <CountryFlag
                        isoCode={
                          design.designElements[0]?.element.norm.country.isoCode
                        }
                        className="w-8 h-5 object-cover ml-2"
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Actualizado: {formatDate(design.updatedAt)}
                      </span>
                      <div className="text-blue-600 group-hover:text-blue-700 transition-colors">
                        <span className="text-sm font-medium">
                          Ver detalles →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
