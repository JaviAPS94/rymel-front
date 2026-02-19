import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Select from "../components/core/Select";
import {
  useGetDesignTypesQuery,
  useGetDesignSubtypesByTypeIdQuery,
  useGetElementsByIdsQuery,
  useLazyGetDesignSubtypeWithFunctionsByIdQuery,
  useLazyGetTemplatesByDesignSubtypeIdQuery,
  useGetElementsByFiltersPaginatedMutation,
  useLazyGetDesignByIdQuery,
  useGetDesignsByFiltersPaginatedMutation,
  useLazyGetCountriesQuery,
  useSaveDesignWithSubDesignsMutation,
  useUpdateMutation,
} from "../store";
import { Option } from "../components/core/Select";
import ElementCard from "../components/elements/ElementCard";
import {
  Accessory,
  Design,
  DesignsPaginated,
  DesignWithSubDesigns,
  ElementResponse,
  ElementsPaginated,
  SemiFinishedType,
  SubDesignData,
} from "../commons/types";
import SpreadSheet from "../components/design/SpreadSheet";
import { useErrorAlert } from "../hooks/useAlertError";
import Alert from "../components/core/Alert";
import Button from "../components/core/Button";
import { FaPlus } from "react-icons/fa6";
import { Modal } from "../components/core/Modal";
import Pagination from "../components/core/Pagination";
import NoData from "../components/core/NoData";
import { useAlert } from "../hooks/useAlert";
import { FaList, FaRegCheckCircle, FaSearch } from "react-icons/fa";
import Skeleton from "../components/core/skeletons/Skeleton";
import DesignCard from "../components/design/DesignCard";
import FilterSkeleton from "../components/core/skeletons/FiltersSkeleton";
import CustomInput from "../components/core/CustomInput";
import { BiEraser, BiSearch } from "react-icons/bi";
import { BsSliders2 } from "react-icons/bs";
import { MdOutlineDesignServices } from "react-icons/md";
import Tabs, { TabItem } from "../components/core/Tabs";
import { TemplateType } from "../commons/enums";
import { LuFileSpreadsheet, LuSave } from "react-icons/lu";
import { IoBookOutline } from "react-icons/io5";
import Stepper from "../components/core/Stepper";
import Accesories from "../components/norms/Accesories";
import SemiFinished from "../components/norms/SemiFinished";
import { Sheet } from "../components/design/spreadsheet-types";
import { BookOpen, FileText, Plus, Save } from "lucide-react";
import InstructionsModal from "../components/design/InstructionsModal";

const ElementsDesignPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get("ids");
  const designIdParam = searchParams.get("designId");
  const designId = designIdParam ? parseInt(designIdParam, 10) : null;
  const [createdDesignId, setCreatedDesignId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [selectedTypeDesignFilter, setSelectedTypeDesignFilter] = useState<
    number | null
  >(null);
  const [page, setPage] = useState<number>(1);
  const [designPage, setDesignPage] = useState<number>(1);
  const [limit] = useState<number>(6);
  const designsLimit = 3;
  const [selectedSubType, setSelectedSubType] = useState<number | null>(null);
  const [selectedSubTypeDesignFilter, setSelectedSubTypeDesignFilter] =
    useState<number | null>(null);
  const [selectedElements, setSelectedElements] = useState<ElementResponse[]>(
    [],
  );
  const [showSpreadSheet, setShowSpreadSheet] = useState(true);
  const { alert, showAlert, hideAlert } = useAlert();
  const [newSelectedElements, setNewSelectedElements] = useState<
    ElementResponse[]
  >([]);
  const [newElements, setNewElements] = useState<ElementsPaginated>();
  const [normName, setNormName] = useState<string>("");
  const [designCode, setDesignCode] = useState<string>("");

  const [triggerElements, getNewElementsResult] =
    useGetElementsByFiltersPaginatedMutation();
  const [triggerDesigns, getDesignsResult] =
    useGetDesignsByFiltersPaginatedMutation();
  const [designs, setDesigns] = useState<DesignsPaginated>();
  const [showTemplateLibrary, setShowTemplateLibrary] =
    useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [accessoryModalIsOpen, setAccessoryModalIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedSemiFinished, setSelectedSemiFinished] =
    useState<SemiFinishedType>();
  const [accessoriesData, setAccessoriesData] = useState<Accessory[]>([]);
  const [selectedSubItems, setSelectedSubItems] = useState<number[]>([]);
  const [saveDesignWithSubDesigns, saveDesignWithSubDesignsResult] =
    useSaveDesignWithSubDesignsMutation();
  const [updateDesign, updateDesignResult] = useUpdateMutation();

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (
      updateDesignResult.isSuccess ||
      saveDesignWithSubDesignsResult.isSuccess
    ) {
      updateDesignResult.reset();
      saveDesignWithSubDesignsResult.reset();
      resetToInitialState?.();
      setShowModalAfterSaveDesign(true);
      handleScrollToTop();
    }
    if (updateDesignResult.isError || saveDesignWithSubDesignsResult.isError) {
      updateDesignResult.reset();
      saveDesignWithSubDesignsResult.reset();
      showAlert("Error guardando diseño. Inténtalo de nuevo.", "error");
    }
  }, [updateDesignResult, saveDesignWithSubDesignsResult, showAlert]);

  useEffect(() => {
    if (saveDesignWithSubDesignsResult.isSuccess) {
      setCreatedDesignId?.(saveDesignWithSubDesignsResult.data.id);
    }
    if (updateDesignResult.isSuccess) {
      setCreatedDesignId?.(designId!);
    }
  }, [
    saveDesignWithSubDesignsResult,
    updateDesignResult,
    setCreatedDesignId,
    designId,
  ]);

  useEffect(() => {
    if (getDesignsResult.isSuccess) {
      setDesigns(getDesignsResult.data);
    }
  }, [getDesignsResult]);

  useEffect(() => {
    if (getNewElementsResult.isSuccess) {
      setNewElements(getNewElementsResult.data);
    }
  }, [getNewElementsResult]);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isOpenDesignModal, setIsOpenDesignModal] = useState<boolean>(false);
  const [showModalAfterSaveDesign, setShowModalAfterSaveDesign] =
    useState(false);
  const [country, setCountry] = useState<number>();
  const [designBase, setDesignBase] = useState<Design | null>(null);
  const [isModalInitialLoad, setIsModalInitialLoad] = useState<boolean>(false);

  // Shared state for all sheets across both SpreadSheet instances
  const [allInstanceSheets, setAllInstanceSheets] = useState<
    { instanceId: string; sheets: any[] }[]
  >([
    { instanceId: "design", sheets: [] },
    { instanceId: "cost", sheets: [] },
  ]);

  // Handle sheets change from any SpreadSheet instance
  const handleSheetsChange = useCallback(
    (instanceId: string, sheets: any[]) => {
      setAllInstanceSheets((prev) =>
        prev.map((inst) =>
          inst.instanceId === instanceId ? { ...inst, sheets } : inst,
        ),
      );
    },
    [],
  );

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

  const [
    triggerCostTemplates,
    {
      data: costTemplatesData,
      error: errorCostTemplates,
      isLoading: isLoadingCostTemplates,
    },
  ] = useLazyGetTemplatesByDesignSubtypeIdQuery();

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
    },
  );

  const [
    triggerDesignById,
    {
      data: designData,
      error: errorDesignData,
      isLoading: isLoadingDesignData,
    },
  ] = useLazyGetDesignByIdQuery();

  useEffect(() => {
    if (designIdParam) {
      const designId = parseInt(designIdParam, 10);
      if (!isNaN(designId)) {
        setSelectedElements([]);
        setSelectedType(null);
        setSelectedSubType(null);
        setDesignBase(null);

        triggerDesignById(designId);
      }
    }
  }, [designIdParam, triggerDesignById]);

  useEffect(() => {
    if (designData && designData.designElements) {
      setSelectedElements(designData.designElements.map((de) => de.element));
      if (designData.designSubType && designData.designSubType.designType) {
        setSelectedType(designData.designSubType.designType.id);
      }
      if (designData.designSubType) {
        setSelectedSubType(designData.designSubType.id);
        trigger(designData.designSubType.id);
        triggerTemplates({ designSubtypeId: designData.designSubType.id });
        triggerCostTemplates({
          designSubtypeId: designData.designSubType.id,
          type: TemplateType.COST,
        });
      }
    }
  }, [designData, trigger, triggerTemplates]);

  useEffect(() => {
    if (!isLoadingElements) {
      setSelectedElements(elements || []);
      setSelectedType(
        elements && elements.length > 0
          ? elements[0].subType.designType.id
          : null,
      );
    }
  }, [elements, isLoadingElements]);

  const {
    data: types,
    isLoading: isLoadingTypes,
    error: errorTypes,
  } = useGetDesignTypesQuery();

  const {
    data: subTypes,
    isLoading: isLoadingSubTypes,
    error: errorSubTypes,
  } = useGetDesignSubtypesByTypeIdQuery(selectedType || 0, {
    skip: !selectedType,
  });

  const [
    triggerCountries,
    { data: countries, error: errorCountries, isLoading: isLoadingCountries },
  ] = useLazyGetCountriesQuery();

  const handleCountryChange = (countryId: number | undefined) => {
    setCountry(countryId);
  };

  useEffect(() => {
    if (countries && isOpenDesignModal && isModalInitialLoad) {
      setCountry(countries[0]?.id);
    }
  }, [countries, isOpenDesignModal, isModalInitialLoad]);

  const { showErrorAlert, errorMessages, setShowErrorAlert } = useErrorAlert({
    "Error obteniendo los tipos": errorTypes,
    "Error obteniendo subtipos": errorSubTypes,
    "Error obteniendo elementos": errorElements,
    "Error obteniendo funciones del sub tipo": errorSubTypeWithFunctions,
    "Error obteniendo plantillas": errorTemplates,
    "Error obteniendo países": errorCountries,
    "Error obteniendo datos del diseño": errorDesignData,
    "Error obteniendo plantillas de costos": errorCostTemplates,
  });

  useEffect(() => {
    if (subTypes && subTypes.length > 0 && selectedElements.length > 0) {
      const phase = selectedElements[0].sapReference?.split("-")[0];
      const filteredSubType = subTypes.find((st) =>
        phase ? st.code.startsWith(phase) : false,
      );
      if (filteredSubType) {
        setSelectedSubType(filteredSubType.id);
        trigger(filteredSubType.id);
        triggerTemplates({ designSubtypeId: filteredSubType.id });
        triggerCostTemplates({
          designSubtypeId: filteredSubType.id,
          type: TemplateType.COST,
        });
      }
    }
  }, [
    subTypes,
    selectedElements,
    trigger,
    triggerTemplates,
    triggerCostTemplates,
  ]);

  useEffect(() => {
    if (designBase) {
      // Force remount by toggling showSpreadSheet
      setShowSpreadSheet(false);
      setTimeout(() => setShowSpreadSheet(true), 0);
    }
  }, [designBase]);

  const handleElementCheck = (element: ElementResponse) => {
    if (selectedElements.length > 1) {
      setSelectedElements((prev) =>
        prev.filter((item) => item.id !== element.id),
      );
    }
  };

  const handleSelectedTypeDesignFilter = (typeId: number | undefined) => {
    setSelectedTypeDesignFilter(typeId || null);
    setSelectedSubTypeDesignFilter(null);
  };

  const handleSubTypeChange = (subTypeId: number | undefined) => {
    setSelectedSubTypeDesignFilter(subTypeId || null);
    if (subTypeId) {
      trigger(subTypeId);
    }
  };

  const handleElementIsChecked = (element: ElementResponse): boolean => {
    return selectedElements.some((item) => item.id === element.id);
  };

  const handleSearchClick = useCallback(() => {
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
  }, [limit, page, selectedElements, triggerElements]);

  const handleAddNewElements = () => {
    handleSearchClick();
    handleToggleModal();
  };

  const handleSearchDesigns = () => {
    triggerCountries(null);
    setIsOpenDesignModal(true);
    setIsModalInitialLoad(true);
  };

  const handleToggleModal = () => {
    setIsOpen(!isOpen);
    setPage(1);
  };

  const handleToggleDesignModal = () => {
    setIsOpenDesignModal(!isOpenDesignModal);
    setDesignPage(1);
    setCountry(undefined);
    setSelectedTypeDesignFilter(null);
    setSelectedSubTypeDesignFilter(null);
    setNormName("");
    setDesignCode("");
    setDesigns(undefined);
    setIsModalInitialLoad(false);
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

  const handleDesignsPageChange = (newPage: number) => {
    setDesignPage(newPage);
    triggerDesigns({
      page: newPage,
      limit: designsLimit,
      name: normName || undefined,
      country: country || undefined,
      designTypeId: selectedTypeDesignFilter || undefined,
      designSubtypeId: selectedSubTypeDesignFilter || undefined,
      designCode: designCode || undefined,
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
    isChecked: boolean,
  ) => {
    if (isChecked) {
      setNewSelectedElements((prev) => [...prev, element]);
    } else {
      setNewSelectedElements((prev) =>
        prev.filter((item) => item.id !== element.id),
      );
    }
  };

  const handleNavigateToDesignList = () => {
    navigate("/design/list");
  };

  const handleContinueEditing = (designId: number) => {
    window.location.href = `/elements/design?designId=${designId}`;
  };

  const handleNewDesign = () => {
    navigate("/design");
  };

  const handleBack = () => {
    navigate(-1);
  };

  const resetToInitialState = () => {
    setShowSpreadSheet(false);
    setDesignBase(null);
  };

  const handleCleanFilters = () => {
    //setName("");
    setCountry(undefined);
    setSelectedType(null);
    setSelectedSubType(null);
    triggerDesigns({
      page: 1,
      limit: designsLimit,
      name: undefined,
      country: undefined,
      designTypeId: undefined,
      designSubtypeId: undefined,
      designCode: undefined,
    });
  };

  const handleSearchDesignsClick = useCallback(() => {
    setPage(1);
    triggerDesigns({
      page: 1,
      limit: designsLimit,
      name: normName || undefined,
      country: country || undefined,
      designTypeId: selectedTypeDesignFilter || undefined,
      designSubtypeId: selectedSubTypeDesignFilter || undefined,
      designCode: designCode || undefined,
    });
  }, [
    country,
    normName,
    designCode,
    selectedTypeDesignFilter,
    selectedSubTypeDesignFilter,
    triggerDesigns,
  ]);

  useEffect(() => {
    if (country && isOpenDesignModal && isModalInitialLoad) {
      handleSearchDesignsClick();
      setIsModalInitialLoad(false);
    }
  }, [
    country,
    isOpenDesignModal,
    isModalInitialLoad,
    handleSearchDesignsClick,
  ]);

  const handleNavigateToDesignDetail = (designId: number) => {
    window.open(`/design/${designId}/details`, "_blank");
  };

  const handleCopyCalculations = (design: Design) => {
    const transformedDesign = { ...design };
    transformedDesign.subDesigns = design.subDesigns.map((sd) => ({
      ...sd,
      data: typeof sd.data === "string" ? JSON.parse(sd.data) : sd.data,
    }));
    console.log("Copy calculations from design:", transformedDesign.subDesigns);
    console.log("Setting designBase to:", transformedDesign);
    setDesignBase(transformedDesign);
    setIsOpenDesignModal(false); // Close the modal after copying
    showAlert(
      "Cálculos copiados exitosamente del diseño seleccionado!",
      "success",
    );
  };

  const toogleAccessoryModal = () =>
    setAccessoryModalIsOpen(!accessoryModalIsOpen);

  const handleNextStep = () => {
    setStep((prevStep) => prevStep + 1);
  };

  const handleAddAccesory = () => {
    toogleAccessoryModal();
    setStep(0);
    setSelectedSemiFinished(undefined);
  };

  const handleCancel = () => {
    setSelectedSemiFinished(undefined);
    toogleAccessoryModal();
    setStep(0);
  };

  const stepComponents: Record<
    number,
    { title?: string; content: JSX.Element; isFinalStep?: boolean }
  > = {
    0: {
      title: "Selecciona los accesorios",
      content: (
        <Accesories
          accessoriesData={accessoriesData}
          setAccessoriesData={setAccessoriesData}
          selectedSubItems={selectedSubItems}
          setSelectedSubItems={setSelectedSubItems}
        />
      ),
      isFinalStep: false,
    },
    1: {
      title: "Selecciona el semi elaborado",
      content: (
        <SemiFinished setSelectedSemiFinished={setSelectedSemiFinished} />
      ),
      isFinalStep: true,
    },
  };

  // Memoize sheets data to prevent unnecessary recalculations
  const sheetsData = useMemo(() => {
    // Helper function to normalize sheet data (convert arrays to Sets)
    const normalizeSheet = (sheet: any) => ({
      ...sheet,
      templateHiddenRows: new Set(
        Array.isArray(sheet.templateHiddenRows) ? sheet.templateHiddenRows : [],
      ),
      templateHiddenColumns: new Set(
        Array.isArray(sheet.templateHiddenColumns)
          ? sheet.templateHiddenColumns
          : [],
      ),
      userHiddenRows: new Set(
        Array.isArray(sheet.userHiddenRows) ? sheet.userHiddenRows : [],
      ),
      userHiddenColumns: new Set(
        Array.isArray(sheet.userHiddenColumns) ? sheet.userHiddenColumns : [],
      ),
    });

    if (designBase?.subDesigns) {
      return designBase.subDesigns.map((sd) => normalizeSheet(sd.data));
    }
    if (designData?.subDesigns) {
      const parsed = designData.subDesigns.map((sd) =>
        typeof sd.data === "string" ? JSON.parse(sd.data) : sd.data,
      );
      return parsed.map(normalizeSheet);
    }

    return [
      {
        id: "sheet1",
        name: "Hoja1",
        cells: {},
        columnWidths: {},
        rowHeights: {},
        templateHiddenRows: new Set(),
        templateHiddenColumns: new Set(),
        userHiddenRows: new Set(),
        userHiddenColumns: new Set(),
      },
    ];
  }, [designBase, designData]);

  // Memoize cost sheets data to prevent unnecessary recalculations
  const costsSheetsData = useMemo(() => {
    // Helper function to normalize sheet data (convert arrays to Sets)
    const normalizeSheet = (sheet: any) => ({
      ...sheet,
      templateHiddenRows: new Set(
        Array.isArray(sheet.templateHiddenRows) ? sheet.templateHiddenRows : [],
      ),
      templateHiddenColumns: new Set(
        Array.isArray(sheet.templateHiddenColumns)
          ? sheet.templateHiddenColumns
          : [],
      ),
      userHiddenRows: new Set(
        Array.isArray(sheet.userHiddenRows) ? sheet.userHiddenRows : [],
      ),
      userHiddenColumns: new Set(
        Array.isArray(sheet.userHiddenColumns) ? sheet.userHiddenColumns : [],
      ),
    });

    if (designBase?.cost?.subCosts) {
      return designBase.cost.subCosts.map((sd) => normalizeSheet(sd.data));
    }
    if (designData?.cost?.subCosts) {
      return designData.cost.subCosts.map((sd) =>
        typeof sd.data === "string"
          ? normalizeSheet(JSON.parse(sd.data))
          : normalizeSheet(sd.data),
      );
    }
    return [
      {
        id: "costSheet1",
        name: "Hoja1",
        cells: {},
        columnWidths: {},
        rowHeights: {},
        templateHiddenRows: new Set(),
        templateHiddenColumns: new Set(),
        userHiddenRows: new Set(),
        userHiddenColumns: new Set(),
      },
    ];
  }, [designBase, designData]);

  const [designSheets, setDesignSheets] = useState<Sheet[]>(
    sheetsData && sheetsData.length > 0
      ? sheetsData
      : [
          {
            id: `design-sheet1`,
            name: "SubDiseño1",
            cells: {},
            columnWidths: {},
            rowHeights: {},
            templateHiddenRows: new Set(),
            templateHiddenColumns: new Set(),
            userHiddenRows: new Set(),
            userHiddenColumns: new Set(),
          },
        ],
  );

  const [costsSheets, setCostsSheets] = useState<Sheet[]>(
    costsSheetsData && costsSheetsData.length > 0
      ? costsSheetsData
      : [
          {
            id: `cost-sheet1`,
            name: "SubDiseño1",
            cells: {},
            columnWidths: {},
            rowHeights: {},
            templateHiddenRows: new Set(),
            templateHiddenColumns: new Set(),
            userHiddenRows: new Set(),
            userHiddenColumns: new Set(),
          },
        ],
  );

  const handleSaveDesignWithSubDesigns = async () => {
    const subDesignData: SubDesignData[] = designSheets.map((sheet) => {
      // Convert Sets to arrays for JSON serialization
      const serializableSheet = {
        ...sheet,
        templateHiddenRows: Array.from(sheet.templateHiddenRows || []),
        templateHiddenColumns: Array.from(sheet.templateHiddenColumns || []),
        userHiddenRows: Array.from(sheet.userHiddenRows || []),
        userHiddenColumns: Array.from(sheet.userHiddenColumns || []),
      };

      const data: SubDesignData = {
        name: sheet.name,
        code: sheet.id,
        data: serializableSheet as any, // Serialized version for database
      };
      return data;
    });

    if (!selectedSubType) {
      return;
    }

    const designData: DesignWithSubDesigns = {
      name: "Nuevo diseño",
      code: "DESIGN_" + Date.now(),
      elements: selectedElements.map((el) => el.id),
      designSubtypeId: selectedSubType,
      subDesigns: subDesignData,
      cost: {
        name: "Costo " + (designBase ? designBase.name : "Nuevo diseño"),
        code: "COST_" + Date.now(),
        subCosts: costsSheets.map((sheet) => {
          // Convert Sets to arrays for JSON serialization
          const serializableSheet = {
            ...sheet,
            templateHiddenRows: Array.from(sheet.templateHiddenRows || []),
            templateHiddenColumns: Array.from(
              sheet.templateHiddenColumns || [],
            ),
            userHiddenRows: Array.from(sheet.userHiddenRows || []),
            userHiddenColumns: Array.from(sheet.userHiddenColumns || []),
          };

          const data: SubDesignData = {
            name: sheet.name,
            code: sheet.id,
            data: serializableSheet as any, // Serialized version for database
          };
          return data;
        }),
      },
    };

    if (designId) {
      const updatedDesignData: DesignWithSubDesigns & { id: number } = {
        ...designData,
        id: designId,
      };
      await updateDesign(updatedDesignData);
    } else {
      await saveDesignWithSubDesigns(designData);
    }
  };

  const tabsElements: TabItem[] = [
    {
      id: "design",
      label: "DISEÑO",
      content: (
        <>
          {subTypeWithFunctions &&
            templatesData &&
            showSpreadSheet &&
            !isLoadingSubTypeWithFunctions &&
            !isLoadingTemplates && (
              <SpreadSheet
                key={`design-${designBase?.id || designData?.id || "new"}`}
                instanceId="design"
                subTypeWithFunctions={subTypeWithFunctions}
                templates={templatesData}
                element={selectedElements[0]}
                designSubtypeId={selectedSubType}
                setShowModalAfterSaveDesign={setShowModalAfterSaveDesign}
                sheetsInitialData={sheetsData}
                designId={Number(designIdParam)}
                resetToInitialState={resetToInitialState}
                setCreatedDesignId={setCreatedDesignId}
                allSheets={allInstanceSheets}
                onSheetsChange={handleSheetsChange}
                showTemplateLibrary={showTemplateLibrary}
                setShowTemplateLibrary={setShowTemplateLibrary}
                sheets={designSheets}
                setSheets={setDesignSheets}
              />
            )}
          {(isLoadingSubTypeWithFunctions ||
            isLoadingTemplates ||
            isLoadingDesignData) && (
            <div className="flex flex-col justify-center items-center py-12">
              <Skeleton count={10} className="w-3/4 h-96 mb-4" />
            </div>
          )}
        </>
      ),
    },
    {
      id: "cost",
      label: "COSTOS",
      content: (
        <>
          {subTypeWithFunctions &&
            costTemplatesData &&
            showSpreadSheet &&
            !isLoadingSubTypeWithFunctions &&
            !isLoadingCostTemplates && (
              <SpreadSheet
                key={`cost-${designBase?.id || designData?.id || "new"}`}
                instanceId="cost"
                subTypeWithFunctions={subTypeWithFunctions}
                templates={costTemplatesData}
                element={selectedElements[0]}
                designSubtypeId={selectedSubType}
                setShowModalAfterSaveDesign={setShowModalAfterSaveDesign}
                sheetsInitialData={costsSheetsData}
                designId={Number(designIdParam)}
                resetToInitialState={resetToInitialState}
                setCreatedDesignId={setCreatedDesignId}
                allSheets={allInstanceSheets}
                onSheetsChange={handleSheetsChange}
                showTemplateLibrary={showTemplateLibrary}
                setShowTemplateLibrary={setShowTemplateLibrary}
                sheets={costsSheets}
                setSheets={setCostsSheets}
              />
            )}
          {(isLoadingSubTypeWithFunctions ||
            isLoadingCostTemplates ||
            isLoadingDesignData) && (
            <div className="flex flex-col justify-center items-center py-12">
              <Skeleton count={10} className="w-3/4 h-96 mb-4" />
            </div>
          )}
        </>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col items-center justify-center p-4">
        <div className="w-full flex items-start">
          <Button
            outline
            onClick={handleBack}
            className="flex items-center text-rymel-blue hover:text-blue-800 transition-colors"
          >
            <span className="mr-2">←</span>
            Volver
          </Button>
        </div>
        {showModalAfterSaveDesign && createdDesignId && (
          <div className="flex justify-center w-1/2 mb-4 bg-green-50 border-green-200 border px-4 py-2 rounded">
            <FaRegCheckCircle className="h-6 w-6" />
            <div className="text-green-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="font-medium">
                  ¡Diseño guardado exitosamente!
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      handleContinueEditing(
                        createdDesignId ?? Number(designIdParam),
                      )
                    }
                    className="border-green-300 text-green-700 hover:bg-green-100  bg-transparent"
                  >
                    Seguir editando
                  </Button>
                  <Button
                    onClick={handleNewDesign}
                    className="border-green-300 text-green-700 hover:bg-green-100  bg-transparent"
                  >
                    Crear nuevo diseño
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
        <div className="w-full mx-auto bg-white rounded-lg shadow-lg overflow-hidden mt-4">
          <div className="bg-rymel-blue text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex">
                <MdOutlineDesignServices className="text-white h-8 w-8" />
                <h1 className="text-3xl font-bold text-center ml-2">
                  Diseño De Elementos
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <Button
                  success
                  icon={<FaPlus />}
                  className="mt-4"
                  onClick={handleAddNewElements}
                  disabled={showModalAfterSaveDesign}
                >
                  Agregar elementos
                </Button>
                <Button
                  primary
                  icon={<FaSearch />}
                  className="mt-4"
                  onClick={handleSearchDesigns}
                  disabled={showModalAfterSaveDesign}
                >
                  Buscar diseños existentes
                </Button>

                <div className="text-center">
                  <div className="bg-rymel-yellow px-3 py-1 rounded-full text-sm">
                    {types?.find((type) => type.id === selectedType)?.name ||
                      "Tipo no seleccionado"}
                  </div>
                  <div className="text-blue-100 text-sm mt-1">
                    Subtipo:{" "}
                    {subTypes?.find((subType) => subType.id === selectedSubType)
                      ?.name || "Subtipo no seleccionado"}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 w-full my-5 px-4">
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
          <div className="space-y-4 w-full">
            <h2 className="text-3xl font-bold text-center text-rymel-blue">
              Cálculos De Elementos
            </h2>
            <div className="inline-flex items-center justify-center w-full">
              <div className="flex items-center gap-1 p-2 bg-white rounded-2xl shadow-xl border border-slate-200">
                <Button
                  primary
                  className="rounded-xl h-[2.8rem]"
                  onClick={toogleAccessoryModal}
                >
                  <Plus className="h-4 w-4" />
                  Agregar accesorio
                </Button>
                <div className="w-px h-8 bg-slate-200 mx-1" />
                <Button
                  outline
                  className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"
                  onClick={() => setShowInstructions(true)}
                >
                  <BookOpen className="h-4 w-4" />
                  Instrucciones
                </Button>
                <Button
                  outline
                  className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl"
                  onClick={() => setShowTemplateLibrary(true)}
                >
                  <FileText className="h-4 w-4" />
                  Plantillas
                </Button>
                <div className="w-px h-8 bg-slate-200 mx-1" />
                <Button
                  success
                  className="text-white rounded-xl h-[2.8rem]"
                  loading={
                    saveDesignWithSubDesignsResult.isLoading ||
                    updateDesignResult.isLoading
                  }
                  disabled={
                    saveDesignWithSubDesignsResult.isLoading ||
                    updateDesignResult.isLoading
                  }
                  onClick={() => handleSaveDesignWithSubDesigns()}
                >
                  <Save className="h-4 w-4" />
                  Guardar
                </Button>
              </div>
            </div>
          </div>
          <Tabs items={tabsElements} defaultActiveTab="design" />
        </div>
      </div>
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
        }}
        title="Elementos disponibles"
        size="full"
      >
        <div className="bg-white flex flex-col justify-center items-center">
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
                    (item) => item.id === element.id,
                  )}
                />
              ))}
          </div>
          {newElements?.data && newElements.data.length > 0 && (
            <div className="flex align-middle mx-auto mt-2 text-2xl space-x-2">
              <Pagination
                currentPage={page}
                totalPages={newElements?.totalPages || 1}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={isOpenDesignModal}
        onClose={() => {
          handleToggleDesignModal();
        }}
        title="Elige un diseño existente para tomar como base"
        size="full"
        closeOnOutsideClick={false}
      >
        <>
          {isLoadingCountries || isLoadingSubTypes ? (
            <div className="flex justify-between justify-items-center align-middle mb-5">
              <FilterSkeleton />
            </div>
          ) : (
            <div className="justify-center items-center flex">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BsSliders2 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Filtros de búsqueda</h3>
                </div>
              </div>
              <div className="space-y-4 py-6 px-4">
                <div className="max-w-[50rem]">
                  <div className="grid grid-cols-3 gap-4 mt-4">
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
                      value={normName}
                      onChange={setNormName}
                      placeholder="Nombre norma"
                    />
                  </div>
                  <div className="flex justify-between gap-2 mt-4">
                    <Select
                      options={types?.map(
                        (type) =>
                          ({
                            label: type.name,
                            value: type.id,
                          }) as Option<number>,
                      )}
                      selectedValue={selectedTypeDesignFilter}
                      onChange={handleSelectedTypeDesignFilter}
                      isLoading={isLoadingTypes}
                      placeholder="Selecciona un tipo"
                      className="w-64"
                    />
                    <Select
                      options={subTypes?.map(
                        (subType) =>
                          ({
                            label: subType.name,
                            value: subType.id,
                          }) as Option<number>,
                      )}
                      selectedValue={selectedSubTypeDesignFilter}
                      onChange={handleSubTypeChange}
                      isLoading={isLoadingSubTypes}
                      placeholder="Selecciona un sub tipo"
                      disabled={!selectedTypeDesignFilter}
                      className="w-60"
                    />
                    <Button
                      primary
                      loading={getDesignsResult.isLoading}
                      disabled={!country}
                      onClick={handleSearchDesignsClick}
                    >
                      <BiSearch />
                    </Button>
                    <Button
                      cancel
                      disabled={!country && !selectedType && !selectedSubType}
                      onClick={handleCleanFilters}
                    >
                      <BiEraser />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="mt-2">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {designs?.data.map((design, index) => (
                  <DesignCard
                    key={design.id}
                    design={design}
                    index={index}
                    onClick={() => handleNavigateToDesignDetail(design.id)}
                    onClickCopy={() => handleCopyCalculations(design)}
                    isReused
                  />
                ))}
              </div>
            )}
            {designs && designs.data.length > 0 && (
              <div className="flex justify-center align-middle mx-auto mt-4 text-2xl space-x-2">
                <Pagination
                  currentPage={designPage}
                  totalPages={designs.totalPages}
                  onPageChange={handleDesignsPageChange}
                />
              </div>
            )}
          </div>
        </>
      </Modal>
      <InstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
      <Modal
        isOpen={accessoryModalIsOpen}
        onClose={toogleAccessoryModal}
        title="Agregar accesorio"
        size="xl"
        closeOnOutsideClick={false}
      >
        <Stepper
          step={step}
          stepComponents={stepComponents}
          onNextStep={handleNextStep}
          onFinalAction={handleAddAccesory}
          onCancel={handleCancel}
        />
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
