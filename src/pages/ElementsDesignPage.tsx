import { TbLock } from "react-icons/tb";
import { Notice } from "@rymel/ui";
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
  useGenerateDesignCodeMutation,
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
import RecalculationNotice from "../components/design/RecalculationNotice";
import { useErrorAlert } from "../hooks/useAlertError";
import Alert from "../components/core/Alert";
import Button from "../components/core/Button";
import { FaPlus } from "react-icons/fa6";
import { Modal } from "../components/core/Modal";
import { useAlert } from "../hooks/useAlert";
import { FaList, FaSearch } from "react-icons/fa";
import Skeleton from "../components/core/skeletons/Skeleton";
import DesignCard from "../components/design/DesignCard";
import FilterSkeleton from "../components/core/skeletons/FiltersSkeleton";
import CustomInput from "../components/core/CustomInput";
import { BiEraser, BiSearch } from "react-icons/bi";
import { TemplateType } from "../commons/enums";
import { LuFileSpreadsheet, LuSave } from "react-icons/lu";
import { IoBookOutline } from "react-icons/io5";
import Stepper from "../components/core/Stepper";
import Accesories from "../components/norms/Accesories";
import SemiFinished from "../components/norms/SemiFinished";
import { Sheet } from "../components/design/spreadsheet-types";
import { extractMaterialTagValues } from "../components/design/materialTagUtils";
import DesignCodePanel from "../components/design/DesignCodePanel";
import { GenerateDesignCodeResponse } from "../store/apis/designCodeApi";
import {
  BookOpen,
  Calculator,
  ClipboardList,
  DollarSign,
  FileText,
  PenTool,
  Plus,
  Save,
} from "lucide-react";
import InstructionsModal from "../components/design/InstructionsModal";
import BomSummaryTab from "../components/design/bom/BomSummaryTab";
import {
  PageHeader,
  HeaderChip,
  FilterField,
  Pagination,
  Tabs,
  type TabItem,
  EmptyState,
  Page,
} from "@rymel/ui";

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
  const [generateDesignCode, generateDesignCodeResult] =
    useGenerateDesignCodeMutation();
  const [designCodePreview, setDesignCodePreview] =
    useState<GenerateDesignCodeResponse | null>(null);
  const [designCodeError, setDesignCodeError] = useState<string | null>(null);
  const [disambiguationToken, setDisambiguationToken] = useState<string>("");
  // true mientras el usuario ha cambiado el sufijo pero aún no lo ha verificado.
  const [isDirtyDisambiguation, setIsDirtyDisambiguation] = useState(false);

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
      hiddenCells: new Set(
        Array.isArray(sheet.hiddenCells) ? sheet.hiddenCells : [],
      ),
      mergedCells: sheet.mergedCells || [],
      namedRanges: sheet.namedRanges || [],
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
        hiddenCells: new Set(),
        freezeRow: 0,
        freezeColumn: 0,
        mergedCells: [],
        namedRanges: [],
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
      hiddenCells: new Set(
        Array.isArray(sheet.hiddenCells) ? sheet.hiddenCells : [],
      ),
      mergedCells: sheet.mergedCells || [],
      namedRanges: sheet.namedRanges || [],
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
        hiddenCells: new Set(),
        freezeRow: 0,
        freezeColumn: 0,
        mergedCells: [],
        namedRanges: [],
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
            hiddenCells: new Set(),
            freezeRow: 0,
            freezeColumn: 0,
            mergedCells: [],
            namedRanges: [],
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
            hiddenCells: new Set(),
            freezeRow: 0,
            freezeColumn: 0,
            mergedCells: [],
            namedRanges: [],
          },
        ],
  );

  const { moValue: taggedMoValue, materialDevanadoValue: taggedMdValue } =
    useMemo(() => extractMaterialTagValues(designSheets), [designSheets]);

  // Genera (o regenera) el código de diseño en vivo, apenas se tiene el elemento
  // principal, sin esperar a que el usuario etiquete las celdas MO/MD: mientras
  // falten, el backend devuelve una vista previa con placeholders en ese segmento.
  useEffect(() => {
    if (selectedElements.length === 0) {
      setDesignCodePreview(null);
      setDesignCodeError(null);
      return;
    }

    const elementId = selectedElements[0].id;
    const timeoutId = setTimeout(() => {
      generateDesignCode({
        elementId,
        moValue: taggedMoValue,
        materialDevanadoValue: taggedMdValue,
      })
        .unwrap()
        .then((result) => {
          setDesignCodePreview(result);
          setDesignCodeError(null);
        })
        .catch((err) => {
          setDesignCodePreview(null);
          const backendMessage = (
            err as { data?: { message?: string | string[] } }
          )?.data?.message;
          setDesignCodeError(
            Array.isArray(backendMessage)
              ? backendMessage.join(", ")
              : backendMessage ||
                  "No se pudo generar el código de diseño para este elemento.",
          );
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [selectedElements[0]?.id, taggedMoValue, taggedMdValue]);

  // Sincroniza el token de desambiguación con la sugerencia del backend.
  // Solo aplica cuando el código generado es un duplicado; en los demás casos
  // se limpia para que no quede un token obsoleto de una generación anterior.
  useEffect(() => {
    if (!designCodePreview?.isDuplicate) {
      setDisambiguationToken("");
      return;
    }
    // El segmento ANIO incluye el token sugerido (ej: "26A"); el año son 2 dígitos.
    const anioValue =
      designCodePreview.segments.find((s) => s.key === "ANIO")?.value ?? "";
    setDisambiguationToken(anioValue.slice(2));
  }, [designCodePreview]);

  // Código efectivo que se usará al guardar: cuando hay duplicado, se reconstruye
  // con el token que el usuario haya escrito; de lo contrario, es el código directo.
  const effectiveDesignCode = useMemo(() => {
    if (!designCodePreview) return "";
    if (designCodePreview.isDuplicate) {
      const anioValue =
        designCodePreview.segments.find((s) => s.key === "ANIO")?.value ?? "";
      const baseYear = anioValue.slice(0, 2);
      const fixedPrefix = (
        ["FASE", "POTENCIA", "TENSION_PRIMARIA", "TENSION_SECUNDARIA"] as const
      )
        .map(
          (k) =>
            designCodePreview.segments.find((s) => s.key === k)?.value ?? "",
        )
        .join("");
      const yearPrefix = fixedPrefix + baseYear;
      const restSuffix = (designCodePreview.baseCode ?? "").slice(
        yearPrefix.length,
      );
      return `${yearPrefix}${disambiguationToken}${restSuffix}`;
    }
    return designCodePreview.code;
  }, [designCodePreview, disambiguationToken]);

  const handleSaveDesignWithSubDesigns = async () => {
    const subDesignData: SubDesignData[] = designSheets.map((sheet) => {
      // Convert Sets to arrays for JSON serialization
      const serializableSheet = {
        ...sheet,
        templateHiddenRows: Array.from(sheet.templateHiddenRows || []),
        templateHiddenColumns: Array.from(sheet.templateHiddenColumns || []),
        userHiddenRows: Array.from(sheet.userHiddenRows || []),
        userHiddenColumns: Array.from(sheet.userHiddenColumns || []),
        hiddenCells: Array.from(sheet.hiddenCells || []),
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

    if (selectedElements.length === 0) {
      showAlert(
        "Selecciona al menos un elemento antes de guardar el diseño.",
        "error",
      );
      return;
    }

    if (!designCodePreview || !designCodePreview.isComplete) {
      showAlert(
        "Falta etiquetar una celda como Material del Núcleo (MO) y una celda como Material de Devanado (MD) en la hoja del diseño (clic derecho sobre la celda) para completar el código de diseño.",
        "error",
      );
      return;
    }

    if (designCodePreview.isDuplicate && isDirtyDisambiguation) {
      showAlert(
        "Verifica la disponibilidad del sufijo de desambiguación antes de guardar (botón 'Verificar disponibilidad' en el panel del código).",
        "error",
      );
      return;
    }

    const finalCode = effectiveDesignCode.trim();
    if (!finalCode) {
      showAlert("El código de diseño no puede estar vacío.", "error");
      return;
    }

    const designData: DesignWithSubDesigns = {
      name: "Nuevo diseño",
      code: finalCode,
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
            hiddenCells: Array.from(sheet.hiddenCells || []),
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
      icon: <PenTool className="h-4 w-4" />,
      content: (
        <>
          {selectedElements.length > 0 && (
            <DesignCodePanel
              isLoading={generateDesignCodeResult.isLoading}
              preview={designCodePreview}
              errorMessage={designCodeError}
              disambiguationToken={disambiguationToken}
              onTokenChange={setDisambiguationToken}
              onEditingChange={setIsDirtyDisambiguation}
            />
          )}
          <RecalculationNotice subDesignId={designBase?.subDesigns?.[0]?.id} />
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
      icon: <DollarSign className="h-4 w-4" />,
      content: (
        <>
          <RecalculationNotice subDesignId={designBase?.subDesigns?.[1]?.id} />
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
    {
      id: "bom",
      label: "LISTA DE MATERIALES",
      icon: <ClipboardList className="h-4 w-4" />,
      content: (
        <>
          {selectedElements.length > 0 && subTypeWithFunctions && (
            <BomSummaryTab
              element={selectedElements[0]}
              sheets={designSheets}
              subTypeWithFunctions={subTypeWithFunctions}
              designId={designId ?? createdDesignId}
            />
          )}
        </>
      ),
    },
  ];

  const typeName = types?.find((type) => type.id === selectedType)?.name;
  const subTypeName = subTypes?.find(
    (subType) => subType.id === selectedSubType,
  )?.name;
  const isSaving =
    saveDesignWithSubDesignsResult.isLoading ||
    updateDesignResult.isLoading ||
    generateDesignCodeResult.isLoading;

  return (
    <>
      <PageHeader
        back={{ label: "Volver", onClick: handleBack }}
        title="Diseño de elementos"
        meta={
          <>
            <HeaderChip>{typeName || "Tipo no seleccionado"}</HeaderChip>
            <HeaderChip>
              {subTypeName
                ? `Subtipo ${subTypeName}`
                : "Subtipo no seleccionado"}
            </HeaderChip>
          </>
        }
        actions={
          <>
            <Button
              variant="outlineLight"
              size="lg"
              icon={<FaSearch />}
              onClick={handleSearchDesigns}
              disabled={showModalAfterSaveDesign}
            >
              Buscar diseños existentes
            </Button>
            <Button
              variant="light"
              size="lg"
              className="!shadow-none"
              icon={<FaPlus />}
              onClick={handleAddNewElements}
              disabled={showModalAfterSaveDesign}
            >
              Agregar elementos
            </Button>
          </>
        }
      />

      <Page>
        <section
          aria-label="Elementos seleccionados"
          className="grid grid-cols-1 gap-4 rounded-[20px] border bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
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
          {selectedElements?.length === 1 && (
            <div className="self-start">
              <Notice tone="danger" icon={<TbLock className="h-4 w-4" />}>
                Debes seleccionar al menos un elemento.
              </Notice>
            </div>
          )}
        </section>

        {showModalAfterSaveDesign && createdDesignId && (
          <Notice
            tone="success"
            title="¡Diseño guardado exitosamente!"
            actions={
              <>
                <Button
                  onClick={() =>
                    handleContinueEditing(
                      createdDesignId ?? Number(designIdParam),
                    )
                  }
                  base
                  size="sm"
                >
                  Seguir editando
                </Button>
                <Button onClick={handleNewDesign} base size="sm">
                  Crear nuevo diseño
                </Button>
                <Button
                  onClick={handleNavigateToDesignList}
                  base
                  size="sm"
                  icon={<FaList />}
                >
                  Ver todos los diseños
                </Button>
              </>
            }
          />
        )}

        <section
          aria-labelledby="calc-title"
          className="overflow-hidden rounded-[20px] border bg-white"
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-[#EFEEF5] px-6 py-5">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-rymel-blue text-rymel-yellow"
            >
              <Calculator className="h-5 w-5" />
            </span>
            <h2
              id="calc-title"
              className="m-0 flex-auto text-xl font-extrabold text-gray-900"
            >
              Cálculos de elementos
            </h2>
            <Button variant="ghost" onClick={() => setShowInstructions(true)}>
              <BookOpen className="h-4 w-4" />
              Instrucciones
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowTemplateLibrary(true)}
            >
              <FileText className="h-4 w-4" />
              Plantillas
            </Button>
            <Button variant="secondary" onClick={toogleAccessoryModal}>
              <Plus className="h-4 w-4" />
              Agregar accesorio
            </Button>
            <Button
              variant="accent"
              loading={isSaving}
              disabled={isSaving}
              onClick={() => handleSaveDesignWithSubDesigns()}
            >
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </div>
          <Tabs items={tabsElements} defaultValue="design" className="p-6" />
        </section>
      </Page>
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
        <div className="flex flex-col bg-white">
          <Button
            primary
            icon={<FaPlus />}
            className="mb-4 self-end"
            onClick={handleAddNewSelectedElements}
            disabled={newSelectedElements.length === 0}
          >
            Agregar seleccionados
          </Button>
          {newElements?.data.length === 0 && (
            <EmptyState title="No hay resultados para mostrar." />
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
            <div className="mt-4">
              <Pagination
                page={page}
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
        title="Elige un diseño existente como base"
        size="full"
        closeOnOutsideClick={false}
      >
        <>
          {isLoadingCountries || isLoadingSubTypes ? (
            <div className="flex justify-between justify-items-center align-middle mb-5">
              <FilterSkeleton />
            </div>
          ) : (
            <form
              role="search"
              aria-label="Filtros de búsqueda"
              className="-mx-5 -mt-5 mb-5 flex flex-wrap items-end gap-3 border-b border-[#EFEEF5] bg-gray-50 px-5 py-5 sm:-mx-7 sm:px-7"
              onSubmit={(event) => {
                event.preventDefault();
                if (country) handleSearchDesignsClick();
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
                  isLoading={false}
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
                  value={normName}
                  onChange={setNormName}
                  placeholder="Nombre de la norma"
                />
              </FilterField>
              <FilterField label="Tipo" className="basis-[150px]">
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
                  placeholder="Todos"
                />
              </FilterField>
              <FilterField label="Subtipo" className="basis-[150px]">
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
                  placeholder="Todos"
                  disabled={!selectedTypeDesignFilter}
                />
              </FilterField>
              <div className="flex gap-2">
                <Button
                  primary
                  type="submit"
                  aria-label="Buscar"
                  className="!h-[46px] !w-[46px] !px-0"
                  loading={getDesignsResult.isLoading}
                  disabled={!country}
                >
                  <BiSearch className="h-[18px] w-[18px]" />
                </Button>
                <Button
                  variant="secondary"
                  aria-label="Limpiar filtros"
                  className="!h-[46px] !w-[46px] !px-0"
                  disabled={!country && !selectedType && !selectedSubType}
                  onClick={handleCleanFilters}
                >
                  <BiEraser className="h-[18px] w-[18px]" />
                </Button>
              </div>
            </form>
          )}
          <div className="mt-2">
            {getDesignsResult.isLoading ? (
              <p className="text-sm text-gray-500">Cargando…</p>
            ) : !designs?.data || designs.data.length === 0 ? (
              <div>
                <EmptyState title="No hay resultados para mostrar." />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              <div className="mt-4">
                <Pagination
                  page={designPage}
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
