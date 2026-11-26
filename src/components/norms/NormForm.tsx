import { inputClass, inputErrorClass, labelClass } from "../core/styles";
import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import ElementForm from "./ElementForm";
import {
  Country,
  ElementResponse,
  Specification,
  Type,
} from "../../commons/types";
import { NormData, NormElement } from "../../pages/NormPage";
import DataTable from "./DataTable";
import { useGetSubTypesWithFieldsByTypeQuery } from "../../store";
import Alert from "../core/Alert";
import Button from "../core/Button";
import { FaPlus, FaRegCopy, FaTimes } from "react-icons/fa";
import Select, { Option } from "../core/Select";
import { useNorm } from "../../hooks/useNorm";
import { FileUpload, FileUploadHandle } from "../core/FileUpload";
import { useAlert } from "../../hooks/useAlert";
import { SectionCard, IconButton } from "@rymel/ui";

interface NormFormProps {
  countries: Country[] | undefined;
  types: Type[] | undefined;
  formData: NormData;
  setFormData: React.Dispatch<React.SetStateAction<NormData>>;
  elementsByFilters: ElementResponse[] | undefined;
  specifications: Specification[] | undefined;
  handleFileSelect: (file: File | null) => void;
  fileUploadRef: React.RefObject<FileUploadHandle | null>;
  /** La lista de elementos ya cargados; se pinta dentro del paso 2. */
  elementsSlot?: React.ReactNode;
}

const NormForm = ({
  countries,
  types,
  formData,
  setFormData,
  elementsByFilters,
  specifications,
  handleFileSelect,
  fileUploadRef,
  elementsSlot,
}: NormFormProps) => {
  const [showLoadable, setShowLoadable] = useState(false);
  const [selectedType, setSelectedType] = useState<number>();
  const [selectedSubType, setSelectedSubType] = useState<number>();
  const [selectedSubTypeName, setSelectedSubTypeName] = useState<string>("");
  const [baseFields, setBaseFields] =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useState<Record<string, Record<string, any>>>();
  const [typeModalIsOpen, setTypeModalIsOpen] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [elementTypeErrors, setElementTypeErrors] = useState<
    Record<string, string>
  >({});
  const [countryCode, setCountryCode] = useState<string | undefined>();
  const [subTypeCode, setSubtypeCode] = useState<string | undefined>();

  const {
    showAddElement,
    toogleShowAddElement,
    showAddElementButton,
    toogleShowAddElementButton,
    editingElement,
    handleDisableEdit,
    handleEditingElement,
  } = useNorm();

  const { alert, showAlert, hideAlert } = useAlert();

  const {
    data: subTypes,
    error: errorSubTypes,
    isLoading: isLoadingSubTypes,
  } = useGetSubTypesWithFieldsByTypeQuery(selectedType || 0);

  useEffect(() => {
    if (errorSubTypes) {
      setShowErrorAlert(true);
      setTimeout(() => setShowErrorAlert(false), 3000);
    }
  }, [errorSubTypes]);

  const handleOpenTypeModal = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name == "") {
      newErrors.name = "Debes seleccionar el nombre de la norma";
    }

    if (!formData.version || formData.version == "") {
      newErrors.version = "La norma debe tener una versión";
    }

    if (!formData.country) {
      newErrors.country = "Debes seleccionar un país";
    }

    if (!formData.normFile) {
      newErrors.normFile = "Debes cargar un archivo";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setTypeModalIsOpen(true);
    }
  };

  const closeTypeModal = () => setTypeModalIsOpen(false);

  const handleCancelAddElement = () => {
    setSelectedType(undefined);
    setSelectedSubType(undefined);
    setSelectedSubTypeName("");
    setElementTypeErrors({});
    closeTypeModal();
  };

  const handleShowAddElement = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedType) {
      newErrors.type = "Debes seleccionar un tipo";
    }

    if (!selectedSubType) {
      newErrors.subType = "Debes seleccionar un sub tipo";
    }

    setElementTypeErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setBaseFields(
        subTypes?.find((subType) => subType.id === Number(selectedSubType))
          ?.field.base,
      );
      toogleShowAddElement();
      toogleShowAddElementButton();
      closeTypeModal();
      handleDisableEdit(true);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;

    setFormData({
      ...formData,
      [name]: type === "file" ? e.target.files : value,
    });
  };

  const handleCountryChange = (countryId: number | undefined) => {
    setFormData({ ...formData, country: countryId });
    setCountryCode(
      countries?.find((country) => country.id === countryId)?.isoCode,
    );
  };

  const handleNormChange = (normCode: string | undefined) => {
    setFormData({ ...formData, name: normCode });
  };

  const handleAddElementToNorm = (element: NormElement) => {
    const elementWithType = {
      ...element,
      subType: Number(selectedSubType),
      subTypeName: selectedSubTypeName,
    };
    setFormData((prevData) => ({
      ...prevData,
      elements: [...prevData.elements, elementWithType],
    }));
    showAlert("Elemento agregado correctamente.", "success");
    toogleShowAddElementButton();
    toogleShowAddElement();
    setSelectedType(undefined);
    setSelectedSubType(undefined);
    setSelectedSubTypeName("");
  };

  const handleUpdateElementNorm = (element: NormElement, index: number) => {
    setFormData((prevData) => {
      const elements = [...prevData.elements];
      elements[index] = {
        ...elements[index],
        ...element,
      };
      return {
        ...prevData,
        elements,
      };
    });
  };

  const handleResetStatesAfterUpdateElementNorm = () => {
    toogleShowAddElementButton();
    toogleShowAddElement();
    setSelectedType(undefined);
    setSelectedSubType(undefined);
    handleDisableEdit(false);
    handleEditingElement(null);
  };
  const handleSelectedType = (typeId: number | undefined) => {
    setSelectedType(typeId);
  };

  const handleSubTypeChange = (subTypeId: number | undefined) => {
    const subTypeSelect = subTypes?.find((subType) => subType.id === subTypeId);
    setSelectedSubType(subTypeId);
    setSubtypeCode(subTypeSelect?.code);
    setSelectedSubTypeName(subTypeSelect?.name || "");
  };

  useEffect(() => {
    if (formData.country && countries) {
      setCountryCode(
        countries?.find((country) => country.id === formData.country)?.isoCode,
      );
    }
  }, [formData, countries]);

  // Al abrirse el formulario de un elemento (elegido de la tabla o nuevo) el
  // atajo ya cumplió: se cierra para que no reaparezca al terminar.
  useEffect(() => {
    if (showAddElement) setShowLoadable(false);
  }, [showAddElement]);

  const locked = formData.elements.length > 0;
  const loadable = elementsByFilters ?? [];

  return (
    <>
      <SectionCard
        step={1}
        title="Datos generales"
        description={
          locked
            ? "Bloqueados mientras la norma tenga elementos cargados."
            : "Identifican la norma. Complétalos antes de cargar elementos."
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelClass}>Norma</label>
            <Select
              options={specifications?.map(
                (specification) =>
                  ({
                    label: specification.name,
                    value: specification.code,
                  }) as Option<string>,
              )}
              selectedValue={formData.name}
              onChange={handleNormChange}
              isLoading={false}
              placeholder="Selecciona una norma"
              error={errors}
              errorKey="name"
              disabled={locked}
            />
          </div>

          <div>
            <label className={labelClass}>Versión</label>
            <input
              type="text"
              name="version"
              value={formData.version}
              onChange={handleChange}
              placeholder="Ej. 1.0.0"
              className={`${inputClass} ${errors.version ? inputErrorClass : ""}`}
              disabled={locked}
            />
            {errors.version && (
              <span className="text-red-500 text-sm">{errors.version}</span>
            )}
          </div>

          <div>
            <label className={labelClass}>País</label>
            <Select
              options={countries?.map(
                (country) =>
                  ({
                    label: country.name,
                    value: country.id,
                  }) as Option<number>,
              )}
              selectedValue={formData.country}
              onChange={handleCountryChange}
              isLoading={false}
              placeholder="Selecciona un país"
              error={errors}
              errorKey="country"
              disabled={locked}
            />
          </div>

          <div className="md:col-span-3">
            <label className={labelClass}>Documento asociado a la norma</label>
            <FileUpload
              ref={fileUploadRef}
              onFileSelect={handleFileSelect}
              showUploadButton={false}
              accept="image/*,application/pdf,.docx"
              maxSize={10 * 1024 * 1024}
              initialFile={formData.normFile}
            />
            {errors.normFile && (
              <span className="text-red-500 text-sm">{errors.normFile}</span>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        step={2}
        title={`Elementos (${formData.elements.length})`}
        description="Cada elemento es un producto de la norma con sus valores y su referencia ERP."
        actions={
          showAddElementButton && (
            <>
              {/* El atajo va junto a «Agregar elemento»: es la otra forma de
                  empezar uno, y aquí se ve sin hacer scroll. */}
              <Button
                base
                active={showLoadable}
                disabled={loadable.length === 0}
                title={
                  loadable.length === 0
                    ? "No hay elementos registrados para esta norma y país"
                    : "Usa los valores de un elemento ya registrado como punto de partida"
                }
                onClick={() => setShowLoadable((open) => !open)}
                icon={<FaRegCopy />}
              >
                Cargar desde existente
                <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">
                  {loadable.length}
                </span>
              </Button>
              <Button primary onClick={handleOpenTypeModal} icon={<FaPlus />}>
                Agregar elemento
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4">
          {showLoadable && showAddElementButton && (
            <div className="rounded-lg border border-rymel-blue/20 bg-rymel-blue/5 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Cargar desde un elemento existente
                  </h3>
                  <p className="text-sm text-gray-600">
                    Elige uno y se abrirá el formulario con sus valores como
                    punto de partida.
                  </p>
                </div>
                <IconButton
                  label="Cerrar"
                  onClick={() => setShowLoadable(false)}
                >
                  <FaTimes className="h-4 w-4" />
                </IconButton>
              </div>
              <DataTable
                data={loadable}
                setBaseFields={setBaseFields}
                setSelectedSubType={setSelectedSubType}
              />
            </div>
          )}
          {elementsSlot}
          {showAddElement && (baseFields || editingElement !== null) && (
            <ElementForm
              baseFieldsValue={baseFields}
              handleAddElementToNorm={handleAddElementToNorm}
              handleUpdateElementNorm={handleUpdateElementNorm}
              handleResetStatesAfterUpdateElementNorm={
                handleResetStatesAfterUpdateElementNorm
              }
              countryCode={countryCode}
              normData={formData}
              subTypeCode={subTypeCode}
              subTypes={subTypes}
            />
          )}
        </div>
      </SectionCard>

      <Modal
        isOpen={typeModalIsOpen}
        onRequestClose={closeTypeModal}
        className="fixed inset-0 flex items-center justify-center p-4 outline-none"
        overlayClassName="fixed inset-0 z-50 bg-[#0E0C2E]/60"
        ariaHideApp={false}
      >
        <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-[0_32px_80px_rgba(0,0,0,.35)]">
          <h2 className="text-xl font-extrabold text-gray-900">
            Tipo de elemento
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Elige el tipo y el subtipo del elemento que vas a agregar.
          </p>
          <div className="mt-4">
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
              isLoading={false}
              placeholder="Selecciona un tipo"
              error={elementTypeErrors}
              errorKey="type"
            />
          </div>
          <div className="mt-4">
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
              error={elementTypeErrors}
              errorKey="subType"
            />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button base onClick={handleCancelAddElement} icon={<FaTimes />}>
              Cancelar
            </Button>
            <Button primary onClick={handleShowAddElement} icon={<FaPlus />}>
              Agregar
            </Button>
          </div>
        </div>
      </Modal>
      {showErrorAlert && (
        <Alert message="Ha ocurrido un error al cargar los datos" error />
      )}
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

export default NormForm;
