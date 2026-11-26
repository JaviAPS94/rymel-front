import { useCallback, useEffect, useRef, useState } from "react";
import {
  useGetCountriesQuery,
  useGetElementsByFiltersPaginatedMutation,
} from "../store";
import Select, { Option } from "../components/core/Select";
import CustomInput from "../components/core/CustomInput";
import { useGetAllSubTypesQuery } from "../store";
import Button from "../components/core/Button";
import { BiEraser, BiSearch } from "react-icons/bi";
import { TbArrowRight } from "react-icons/tb";
import ElementTable from "../components/elements/ElementTable";
import { ElementResponse, ElementsPaginated } from "../commons/types";
import { useNavigate } from "react-router-dom";
import Alert from "../components/core/Alert";
import { useErrorAlert } from "../hooks/useAlertError";
import {
  SelectionBar,
  PageHeader,
  IconButton,
  FilterField,
  Pagination,
  EmptyState,
  Page,
} from "@rymel/ui";

const DesignPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(12);
  const [name, setName] = useState<string>("");
  const [country, setCountry] = useState<number>();
  const [subType, setSubType] = useState<string>();
  const [sapReference, setSapReference] = useState<string>("");
  const [selectedElements, setSelectedElements] = useState<ElementResponse[]>(
    [],
  );
  const [elements, setElements] = useState<ElementsPaginated>();
  const [normId, setNormId] = useState<number | null>(null);
  const [isFilteringByNorm, setIsFilteringByNorm] = useState<boolean>(false);
  const isInitialLoad = useRef(true);

  const {
    data: countries,
    isLoading: isLoadingCountries,
    error: errorCountries,
  } = useGetCountriesQuery(null);

  const {
    data: subTypes,
    isLoading: isLoadingSubTypes,
    error: errorSubTypes,
  } = useGetAllSubTypesQuery();

  const [trigger, getElementsResult] =
    useGetElementsByFiltersPaginatedMutation();

  useEffect(() => {
    if (getElementsResult.isSuccess) {
      setElements(getElementsResult.data);
      setIsFilteringByNorm(false);
    }
    if (getElementsResult.isError) {
      setIsFilteringByNorm(false);
    }
  }, [getElementsResult]);

  const { showErrorAlert, errorMessages, setShowErrorAlert } = useErrorAlert({
    "Error obteniendo países": errorCountries,
    "Error obteniendo subtipos": errorSubTypes,
  });

  useEffect(() => {
    // Solo ejecutar si normId ha cambiado (no en el primer render)
    if (normId !== null || selectedElements.length === 0) {
      setIsFilteringByNorm(true);
      // Limpiar elementos actuales para mostrar loading
      setElements(undefined);

      trigger({
        page: 1,
        limit,
        name: name || undefined,
        country: country || undefined,
        subType: subType || undefined,
        sapReference: sapReference || undefined,
        normId: normId || undefined,
      });
      setPage(1);
    }
  }, [normId]); //eslint-disable-line

  const handleSearchClick = useCallback(() => {
    setSelectedElements([]);
    setPage(1);
    trigger({
      page: 1,
      limit,
      name: name || undefined,
      country: country || undefined,
      subType: subType || undefined,
      sapReference: sapReference || undefined,
    });
  }, [limit, name, country, subType, sapReference, trigger]);

  const handleCountryChange = (countryId: number | undefined) => {
    setCountry(countryId);
  };

  const handleSubTypeChange = (subTypeName: string | undefined) => {
    setSubType(subTypeName);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    trigger({
      page: newPage,
      limit,
      name: name || undefined,
      country: country || undefined,
      subType: subType || undefined,
      sapReference: sapReference || undefined,
    });
  };

  const handleCleanFilters = () => {
    setSelectedElements([]);
    setName("");
    setCountry(undefined);
    setSubType(undefined);
    setSapReference("");
    trigger({
      page: 1,
      limit,
      name: undefined,
      country: undefined,
      subType: undefined,
      sapReference: undefined,
    });
  };

  const handleElementCheck = (element: ElementResponse, isChecked: boolean) => {
    if (isChecked) {
      //agrega nuevo elemento al arreglo
      //take last state of selectedElements
      const newSelectedElements = [...selectedElements, element];
      if (newSelectedElements.length === 1) {
        // Agregar un pequeño delay para suavizar la transición
        setTimeout(() => {
          setNormId(element.norm.id);
        }, 100);
      }
      setSelectedElements(newSelectedElements);
    } else {
      //remueve el elemento del arreglo
      const newSelectedElements = selectedElements.filter(
        (item) => item.id !== element.id,
      );
      setSelectedElements(newSelectedElements);
      if (newSelectedElements.length === 0) {
        // Agregar un pequeño delay para suavizar la transición
        setTimeout(() => {
          setNormId(null);
        }, 100);
      }
    }
  };

  const handleDeleteSelected = () => {
    setSelectedElements([]);
    trigger({
      page: 1,
      limit,
      name: name || undefined,
      country: country || undefined,
      subType: subType || undefined,
      sapReference: sapReference || undefined,
    });
    setPage(1);
    setNormId(null);
  };

  const handleContinueWithSelected = () => {
    const selectedIds = selectedElements.map((el) => el.id).join(",");
    navigate(`/elements/design?ids=${selectedIds}`);
  };

  useEffect(() => {
    if (countries) {
      setCountry(countries[0]?.id);
    }
  }, [countries]);

  useEffect(() => {
    if (country && isInitialLoad.current) {
      isInitialLoad.current = false;
      handleSearchClick();
    }
  }, [country, handleSearchClick]);

  const selectedIds = new Set(selectedElements.map((element) => element.id));
  const isSearching = isFilteringByNorm || getElementsResult.isLoading;

  return (
    <>
      <PageHeader
        eyebrow="Paso 1 · Elementos"
        title="Nuevo diseño"
        description={
          elements ? (
            <>
              Elige los elementos del diseño.{" "}
              <strong>{elements.total} disponibles</strong> con estos filtros.
            </>
          ) : (
            "Elige los elementos sobre los que se calcula el diseño."
          )
        }
      />

      <Page className="pb-10">
        <form
          role="search"
          aria-label="Filtrar elementos"
          className="flex flex-wrap items-end gap-3 rounded-[20px] border bg-white p-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearchClick();
          }}
        >
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
          <FilterField label="Norma">
            <CustomInput
              type="text"
              value={name}
              onChange={setName}
              placeholder="Nombre de la norma"
            />
          </FilterField>
          <FilterField label="Referencia ERP">
            <CustomInput
              type="text"
              mono
              value={sapReference}
              onChange={setSapReference}
              placeholder="Ej. 1-25-220"
            />
          </FilterField>
          <FilterField label="Subtipo">
            <Select
              options={subTypes?.map(
                (subType) =>
                  ({
                    label: subType.name,
                    value: subType.name,
                  }) as Option<string>,
              )}
              selectedValue={subType}
              onChange={handleSubTypeChange}
              isLoading={isLoadingSubTypes}
              placeholder="Todos"
              errorKey="country"
            />
          </FilterField>
          <div className="flex items-center gap-2">
            <Button
              primary
              type="submit"
              className="!h-[46px] px-[22px]"
              loading={getElementsResult.isLoading}
            >
              <BiSearch className="h-[17px] w-[17px]" />
              Buscar
            </Button>
            <IconButton
              label="Limpiar filtros"
              className="!h-[46px] !w-[46px] !rounded-xl"
              onClick={handleCleanFilters}
            >
              <BiEraser className="h-4 w-4" />
            </IconButton>
          </div>
        </form>

        {isSearching ? (
          <p className="text-sm text-gray-600">Cargando…</p>
        ) : !elements || elements.data.length === 0 ? (
          <EmptyState title="Ningún elemento coincide con los filtros." />
        ) : (
          <ElementTable
            items={elements.data}
            selectedIds={selectedIds}
            onToggle={handleElementCheck}
            footer={
              <Pagination
                page={page}
                totalPages={elements.totalPages}
                onPageChange={handlePageChange}
                totalItems={elements.total}
                pageSize={limit}
              />
            }
          />
        )}

        {/* Barra de selección: siempre a la vista al pie mientras haya elegidos. */}
        {selectedElements.length > 0 && (
          <SelectionBar
            count={selectedElements.length}
            label={
              selectedElements.length === 1
                ? "elemento seleccionado"
                : "elementos seleccionados"
            }
            hint={`Solo se muestran elementos de la norma ${selectedElements[0].norm.name}.`}
            actions={
              <>
                <Button variant="ghostLight" onClick={handleDeleteSelected}>
                  Limpiar selección
                </Button>
                <Button variant="light" onClick={handleContinueWithSelected}>
                  Continuar
                  <TbArrowRight className="h-4 w-4" />
                </Button>
              </>
            }
          />
        )}

        {showErrorAlert && (
          <Alert
            messages={errorMessages}
            error
            onClose={() => setShowErrorAlert(false)}
          />
        )}
      </Page>
    </>
  );
};

export default DesignPage;
