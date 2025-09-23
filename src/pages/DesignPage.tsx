import { useEffect, useState } from "react";
import {
  useGetCountriesQuery,
  useGetElementsByFiltersPaginatedMutation,
} from "../store";
import Select, { Option } from "../components/core/Select";
import CustomInput from "../components/core/CustomInput";
import { useGetAllSubTypesQuery } from "../store";
import NoData from "../components/core/NoData";
import Pagination from "../components/core/Pagination";
import Button from "../components/core/Button";
import { BiEraser, BiSearch } from "react-icons/bi";
import { MdRemoveCircleOutline } from "react-icons/md";
import ElementCard from "../components/elements/ElementCard";
import { ElementResponse, ElementsPaginated } from "../commons/types";
import { IoIosAddCircleOutline } from "react-icons/io";
import { useNavigate } from "react-router-dom";
import Alert from "../components/core/Alert";
import { useErrorAlert } from "../hooks/useAlertError";
import FilterSkeleton from "../components/core/skeletons/FiltersSkeleton";
import Skeleton from "../components/core/skeletons/Skeleton";

const DesignPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(12);
  const [name, setName] = useState<string>("");
  const [country, setCountry] = useState<number>();
  const [subType, setSubType] = useState<string>();
  const [sapReference, setSapReference] = useState<string>("");
  const [selectedElements, setSelectedElements] = useState<ElementResponse[]>(
    []
  );
  const [elements, setElements] = useState<ElementsPaginated>();
  const [normId, setNormId] = useState<number | null>(null);
  const [isFilteringByNorm, setIsFilteringByNorm] = useState<boolean>(false);

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

  const handleSearchClick = () => {
    setSelectedElements([]);
    trigger({
      page,
      limit,
      name: name || undefined,
      country: country || undefined,
      subType: subType || undefined,
      sapReference: sapReference || undefined,
    });
  };

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
        (item) => item.id !== element.id
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

  return (
    <>
      <div
        className={`max-w-full bg-white rounded-lg shadow-lg overflow-hidden pb-5 my-10 mx-10 ${
          !elements?.data || elements.data.length === 0 ? "min-h-screen" : ""
        }`}
      >
        <div className="bg-rymel-blue text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Diseño de elementos</h1>
              <p className="text-white mt-1">
                {elements?.total} elementos disponibles
              </p>
            </div>
            <div className="bg-rymel-yellow px-4 py-2 rounded-lg">
              <span className="text-2xl font-bold">
                {elements?.data.length}
              </span>
              <span className="text-white ml-2">filtrados</span>
            </div>
          </div>
        </div>
        {/* <h1 className="text-3xl font-semibold text-center mb-4">
          Diseño de elementos
        </h1>
        <h2>Buscar el o los elementos para agregar diseños</h2>
        <h3 className="font-bold mt-5">Filtros</h3> */}
        {isLoadingCountries || isLoadingSubTypes ? (
          <div className="flex justify-between justify-items-center align-middle min-w-[70rem] mb-5">
            <FilterSkeleton />
          </div>
        ) : (
          <div className="border-b border-gray-200 flex justify-center">
            <div className="flex max-w-[65rem] min-w-[62rem] justify-between mb-5">
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
                value={name}
                onChange={setName}
                placeholder="Nombre norma"
                className="mt-4"
              />
              <CustomInput
                type="text"
                value={sapReference}
                onChange={setSapReference}
                placeholder="Referencia SAP"
                className="mt-4"
              />
              <Select
                options={subTypes?.map(
                  (subType) =>
                    ({
                      label: subType.name,
                      value: subType.name,
                    } as Option<string>)
                )}
                selectedValue={subType}
                onChange={handleSubTypeChange}
                isLoading={false}
                placeholder="Subtipo"
                errorKey="country"
                className="w-60"
              />
              <Button
                primary
                loading={getElementsResult.isLoading}
                onClick={handleSearchClick}
                className="mt-4"
              >
                <BiSearch />
              </Button>
              <Button cancel onClick={handleCleanFilters} className="mt-4">
                <BiEraser />
              </Button>
            </div>
          </div>
        )}

        {selectedElements.length > 0 && (
          <div className="flex justify-center align-middle transition-all duration-300 ease-in-out">
            <Button
              onClick={handleContinueWithSelected}
              className="mt-5"
              icon={<IoIosAddCircleOutline />}
              success
            >
              Agregar diseño(s)
            </Button>
            <Button
              onClick={handleDeleteSelected}
              className="mt-5 ml-2"
              icon={<MdRemoveCircleOutline />}
              danger
            >
              Quitar seleccionados ({selectedElements.length})
            </Button>
          </div>
        )}
        {isFilteringByNorm || getElementsResult.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 w-full">
            <Skeleton count={10} className="mb-4" />
          </div>
        ) : elements?.data.length === 0 ? (
          <div className="justify-center items-center flex py-12">
            <NoData
              className="w-1/2 bg-gray-400"
              message="No hay resultados para mostrar."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 w-full mt-6 px-10">
            {elements?.data.map((element, index) => (
              <div
                key={element.id}
                className="fade-in-up"
                style={{
                  animationDelay: `${index * 100}ms`,
                  opacity: 0,
                }}
              >
                <ElementCard
                  element={element}
                  onCheckChange={handleElementCheck}
                  isChecked={selectedElements.some(
                    (item) => item.id === element.id
                  )}
                />
              </div>
            ))}
          </div>
        )}
        {elements && elements.data.length > 0 && (
          <div className="flex justify-center align-middle mx-auto mt-4 text-2xl space-x-2">
            <Pagination
              currentPage={page}
              totalPages={elements.totalPages}
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
    </>
  );
};

export default DesignPage;
