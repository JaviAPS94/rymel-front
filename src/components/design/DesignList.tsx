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
import { TbPlus, TbSearch } from "react-icons/tb";
import { useNavigate } from "react-router-dom";
import { Design, DesignsPaginated } from "../../commons/types";
import { useErrorAlert } from "../../hooks/useAlertError";
import Alert from "../core/Alert";
import DesignTable from "./DesignTable";
import {
  PageHeader,
  FilterField,
  Pagination,
  EmptyState,
  Page,
} from "@rymel/ui";

interface DesignListProps {
  onSelectDesign: (design: Design) => void;
}

export default function DesignList({ onSelectDesign }: DesignListProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
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
    setDesignCode("");
    setPage(1);
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

  const isSearching = getDesignsResult.isLoading;

  const hasFilters = Boolean(
    country || name || designCode || selectedType || selectedSubType,
  );
  const countryName = countries?.find((c) => c.id === country)?.name;
  const typeName = types?.find((t) => t.id === selectedType)?.name;
  const subTypeName = subTypes?.find((t) => t.id === selectedSubType)?.name;
  const activeFilters = [
    countryName && `País: ${countryName}`,
    designCode && `Código: ${designCode}`,
    name && `Norma: ${name}`,
    typeName && `Tipo: ${typeName}`,
    subTypeName && `Subtipo: ${subTypeName}`,
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        eyebrow="Biblioteca de diseños"
        title="Diseños"
        description={
          designs ? (
            <>
              <strong>
                {designs.total} {designs.total === 1 ? "diseño" : "diseños"}
              </strong>{" "}
              {designs.total === 1 ? "coincide" : "coinciden"} con tus filtros.
            </>
          ) : (
            "Los diseños calculados sobre cada norma."
          )
        }
        actions={
          <Button
            variant="light"
            size="lg"
            className="!h-[52px] !rounded-[14px] !px-6 !text-base"
            onClick={() => navigate("/design")}
          >
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-rymel-yellow">
              <TbPlus className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            Nuevo diseño
          </Button>
        }
      />

      <Page>
        <form
          role="search"
          aria-label="Filtrar diseños"
          className="flex flex-col gap-4 rounded-[20px] border bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (country) handleSearchClick();
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <FilterField label="País">
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
                isLoading={isLoadingCountries}
                placeholder="País"
                errorKey="country"
              />
            </FilterField>
            <FilterField label="Código de diseño">
              <CustomInput
                type="text"
                value={designCode}
                onChange={setDesignCode}
                placeholder="Ej. 1DAA2612"
              />
            </FilterField>
            <FilterField label="Norma">
              <CustomInput
                type="text"
                value={name}
                onChange={setName}
                placeholder="Nombre de la norma"
              />
            </FilterField>
            <FilterField label="Tipo" className="basis-40">
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
                placeholder="Todos"
              />
            </FilterField>
            <FilterField label="Subtipo" className="basis-36">
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
                placeholder="Todos"
                disabled={!selectedType}
              />
            </FilterField>
            <Button
              primary
              type="submit"
              className="!h-[46px] px-[22px]"
              loading={isSearching}
              disabled={!country}
            >
              <TbSearch className="h-[17px] w-[17px]" />
              Buscar
            </Button>
          </div>
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 border-t border-[#EFEEF5] pt-3.5">
              <span className="text-[13px] text-gray-600">Filtros activos</span>
              {activeFilters.map((filter) => (
                <span
                  key={filter}
                  className="flex h-[30px] items-center rounded-full bg-rymel-soft px-3 text-[13px] font-semibold text-rymel-indigo"
                >
                  {filter}
                </span>
              ))}
              <button
                type="button"
                disabled={!hasFilters}
                onClick={handleCleanFilters}
                className="ml-auto text-[13px] font-semibold text-rymel-indigo hover:text-rymel-blue hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </form>

        {isSearching ? (
          <p className="text-sm text-gray-600">Cargando…</p>
        ) : !designs?.data || designs.data.length === 0 ? (
          <EmptyState title="Ningún diseño coincide con los filtros." />
        ) : (
          <DesignTable
            items={designs.data}
            onSelect={onSelectDesign}
            footer={
              <Pagination
                page={page}
                totalPages={designs.totalPages}
                onPageChange={handlePageChange}
                totalItems={designs.total}
                pageSize={limit}
              />
            }
          />
        )}
      </Page>
      {showErrorAlert && (
        <Alert
          messages={errorMessages}
          error
          onClose={() => setShowErrorAlert(false)}
        />
      )}
    </>
  );
}
