import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Select from "../components/core/Select";
import {
  useGetDesignTypesQuery,
  useGetDesignSubtypesByTypeIdQuery,
  useGetElementsByIdsQuery,
  useLazyGetDesignSubtypeWithFunctionsByIdQuery,
  useLazyGetTemplatesByDesignSubtypeIdQuery,
  useGetElementsByFiltersPaginatedMutation,
} from "../store";
import { Option } from "../components/core/Select";
import ElementCard from "../components/elements/ElementCard";
import { ElementResponse, ElementsPaginated } from "../commons/types";
import SpreadSheet from "../components/design/SpreadSheet";
import { useErrorAlert } from "../hooks/useAlertError";
import Alert from "../components/core/Alert";
import Button from "../components/core/Button";
import { FaPlus } from "react-icons/fa6";
import { Modal } from "../components/core/Modal";
import Pagination from "../components/core/Pagination";
import NoData from "../components/core/NoData";
import { useAlert } from "../hooks/useAlert";
import { FaList, FaRegCheckCircle } from "react-icons/fa";

const ElementsDesignPage = () => {
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get("ids");
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(6);
  const [selectedSubType, setSelectedSubType] = useState<number | null>(null);
  const [selectedElements, setSelectedElements] = useState<ElementResponse[]>(
    []
  );
  const { alert, showAlert, hideAlert } = useAlert();
  const [newSelectedElements, setNewSelectedElements] = useState<
    ElementResponse[]
  >([]);
  const [elementTypeErrors, setElementTypeErrors] = useState<
    Record<string, string>
  >({});
  const [newElements, setNewElements] = useState<ElementsPaginated>();

  const [triggerElements, getNewElementsResult] =
    useGetElementsByFiltersPaginatedMutation();

  useEffect(() => {
    if (getNewElementsResult.isSuccess) {
      setNewElements(getNewElementsResult.data);
    }
  }, [getNewElementsResult]);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showModalAfterSaveDesign, setShowModalAfterSaveDesign] =
    useState(false);

  const ids = idsParam ? idsParam.split(",").map(Number) : [];

  const [
    trigger,
    {
      data: subTypeWithFunctions,
      error: errorSubTypeWithFunctions,
      isLoading: isLoadingSubTypeWithFunctions,
    },
  ] = useLazyGetDesignSubtypeWithFunctionsByIdQuery();

  const [
    triggerTemplates,
    {
      data: templatesData,
      error: errorTemplates,
      isLoading: isLoadingTemplates,
    },
  ] = useLazyGetTemplatesByDesignSubtypeIdQuery();

  // Fetch elements by IDs
  const {
    data: elements,
    isLoading: isLoadingElements,
    error: errorElements,
  } = useGetElementsByIdsQuery(
    {
      ids,
    },
    {
      skip: ids.length === 0,
    }
  );

  useEffect(() => {
    if (!isLoadingElements) {
      setSelectedElements(elements || []);
    }
  }, [elements, isLoadingElements]);

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

  const { showErrorAlert, errorMessages, setShowErrorAlert } = useErrorAlert({
    "Error obteniendo los tipos": errorTypes,
    "Error obteniendo subtipos": errorSubTypes,
    "Error obteniendo elementos": errorElements,
    "Error obteniendo funciones del sub tipo": errorSubTypeWithFunctions,
    "Error obteniendo plantillas": errorTemplates,
  });

  const handleElementCheck = (element: ElementResponse) => {
    if (selectedElements.length > 1) {
      setSelectedElements((prev) =>
        prev.filter((item) => item.id !== element.id)
      );
    }
  };

  // Handlers for select inputs
  const handleSelectedType = (typeId: number | undefined) => {
    setSelectedType(typeId || null);
    setSelectedSubType(null); // Reset subtype when type changes
  };

  const handleSubTypeChange = (subTypeId: number | undefined) => {
    setSelectedSubType(subTypeId || null);
    if (subTypeId) {
      trigger(subTypeId);
      triggerTemplates(subTypeId);
    }
  };

  const handleElementIsChecked = (element: ElementResponse): boolean => {
    return selectedElements.some((item) => item.id === element.id);
  };

  const handleSearchClick = () => {
    setNewSelectedElements([]);
    triggerElements({
      page,
      limit,
      name: undefined,
      country: selectedElements[0].norm.country.id || undefined,
      subType: undefined,
      sapReference: undefined,
      excludeElementIds: selectedElements.map((el) => el.id),
      normId: selectedElements[0].norm.id || undefined,
    });
  };

  const handleAddNewElements = () => {
    handleSearchClick();
    handleToggleModal();
  };

  const handleToggleModal = () => {
    setIsOpen(!isOpen);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    triggerElements({
      page: newPage,
      limit,
      name: undefined,
      country: selectedElements[0].norm.country.id || undefined,
      subType: undefined,
      sapReference: undefined,
      excludeElementIds: selectedElements.map((el) => el.id),
    });
  };

  const handleAddNewSelectedElements = () => {
    try {
      setSelectedElements((prev) => [...prev, ...newSelectedElements]);
      setNewSelectedElements([]);
      setIsOpen(false);
      setPage(1);
      showAlert("Elemento(s) agregado(s) exitosamente!", "success");
    } catch {
      showAlert("Error agregando elemento(s). Inténtalo de nuevo.", "error");
      return;
    }
  };

  const handleNewElementCheck = (
    element: ElementResponse,
    isChecked: boolean
  ) => {
    if (isChecked) {
      setNewSelectedElements((prev) => [...prev, element]);
    } else {
      setNewSelectedElements((prev) =>
        prev.filter((item) => item.id !== element.id)
      );
    }
  };

  const handleNavigateToDesignList = () => {
    window.location.href = "/design/list";
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center p-4">
        {showModalAfterSaveDesign && (
          <div className="flex justify-center w-1/2 mb-4 bg-green-50 border-green-200 border px-4 py-2 rounded">
            <FaRegCheckCircle className="h-6 w-6" />
            <div className="text-green-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="font-medium">
                  ¡Diseño guardado exitosamente!
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setShowModalAfterSaveDesign(false)}
                    className="border-green-300 text-green-700 hover:bg-green-100  bg-transparent"
                  >
                    Seguir editando
                  </Button>
                  <Button
                    onClick={() => setShowModalAfterSaveDesign(false)}
                    className="border-green-300 text-green-700 hover:bg-green-100 bg-transparent"
                    icon={<FaPlus />}
                  >
                    Duplicar diseño
                  </Button>
                  <Button
                    onClick={handleNavigateToDesignList}
                    className="border-green-300 text-green-700 hover:bg-green-100 bg-transparent"
                    icon={<FaList />}
                  >
                    Ver todos los diseños
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        <h1 className="text-2xl font-bold text-center">Diseño de Elementos</h1>
        <Button
          primary
          icon={<FaPlus />}
          className="mt-4"
          onClick={handleAddNewElements}
        >
          Agregar elementos
        </Button>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 w-full my-5">
          {selectedElements?.map((element) => (
            <ElementCard
              key={element.id}
              element={element}
              onCheckChange={handleElementCheck}
              isChecked={handleElementIsChecked(element)}
              isBlocked={selectedElements.length <= 1}
              blockedReason="Debes seleccionar al menos un elemento"
            />
          ))}
        </div>
        <h2 className="font-bold text-xl mt-4">
          Selecciona el tipo y sub tipo del diseño
        </h2>
        <div className="flex mt-4 gap-4">
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
            error={elementTypeErrors}
            errorKey="type"
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
            error={elementTypeErrors}
            errorKey="subType"
            disabled={!selectedType}
            className="w-60"
          />
        </div>
      </div>
      {subTypeWithFunctions && templatesData && (
        <SpreadSheet
          subTypeWithFunctions={subTypeWithFunctions}
          templates={templatesData}
          elementIds={ids}
          designSubtypeId={selectedSubType}
          setShowModalAfterSaveDesign={setShowModalAfterSaveDesign}
        />
      )}
      {showErrorAlert && (
        <Alert
          messages={errorMessages}
          error
          onClose={() => setShowErrorAlert(false)}
        />
      )}
      <Modal
        isOpen={isOpen}
        onClose={() => {
          handleToggleModal();
          //onSearchChange("");
          //onPageChange(1);
        }}
        title="Elementos disponibles"
        size="full"
      >
        <div className="bg-white rounded-lg w p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col justify-center items-center">
          <Button
            primary
            icon={<FaPlus />}
            className="w-64 mb-4"
            onClick={handleAddNewSelectedElements}
            disabled={newSelectedElements.length === 0}
          >
            Agregar seleccionados
          </Button>
          {newElements?.data.length === 0 && (
            <NoData
              className="w-1/2 bg-gray-400"
              message="No hay resultados para mostrar."
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 w-full">
            {newElements?.data &&
              newElements.data.length > 0 &&
              newElements.data.map((element) => (
                <ElementCard
                  key={element.id}
                  element={element}
                  onCheckChange={handleNewElementCheck}
                  isChecked={newSelectedElements.some(
                    (item) => item.id === element.id
                  )}
                />
              ))}
          </div>
          {newElements?.data && newElements.data.length > 0 && (
            <div className="flex align-middle mx-auto mt-4 text-2xl space-x-2">
              <Pagination
                currentPage={page}
                totalPages={newElements?.totalPages || 1}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </Modal>
      {alert.visible && (
        <Alert
          success={alert.type === "success"}
          error={alert.type === "error"}
          message={alert.message}
          onClose={hideAlert}
        />
      )}
    </>
  );
};

export default ElementsDesignPage;
