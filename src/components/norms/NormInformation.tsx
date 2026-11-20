import React, { useEffect, useState } from "react";
import { NormData, NormElement } from "../../pages/NormPage";
import Button from "../core/Button";
import { useSaveNormMutation } from "../../store";
import Alert from "../core/Alert";
import AccesoriesTable from "./AccesoriesTable";
import { Accessory, SemiFinishedType } from "../../commons/types";
import { FaPlus } from "react-icons/fa";
import { BiEdit, BiTrash } from "react-icons/bi";
import { LuSave } from "react-icons/lu";
import { useNorm } from "../../hooks/useNorm";
import { Modal } from "../core/Modal";
import CheckboxList from "../core/CheckboxList";
import Accesories from "./Accesories";
import SemiFinished from "./SemiFinished";
import Stepper from "../core/Stepper";
import { FileUpload } from "../core/FileUpload";
import { SelectionBar } from "@rymel/ui";

interface NormInformationProps {
  formData: NormData;
  setFormData: React.Dispatch<React.SetStateAction<NormData>>;
  handleReset: () => void;
  isEditing: boolean;
}

const NormInformation = ({
  formData,
  setFormData,
  handleReset,
  isEditing,
}: NormInformationProps) => {
  const [expandedElements, setExpandedElements] = useState<number[]>([]);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [accessoryModalIsOpen, setAccessoryModalIsOpen] = useState(false);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedSubItems, setSelectedSubItems] = useState<number[]>([]);
  const [selectedSemiFinished, setSelectedSemiFinished] =
    useState<SemiFinishedType>();
  const [accessoriesData, setAccessoriesData] = useState<Accessory[]>([]);
  const [step, setStep] = useState(0);
  const {
    disableEdit,
    handleEditingElement,
    handleShowAddElement,
    handleShowAddElementButton,
    handleDisableEdit,
  } = useNorm();

  const [saveNorm, saveNormResult] = useSaveNormMutation();

  useEffect(() => {
    if (saveNormResult.isSuccess) {
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
      setFormData({
        name: "",
        version: "",
        country: 0,
        normFile: null,
        elements: [],
      });
      if (!isEditing) {
        setTimeout(() => {
          handleReset();
        }, 100);
      }
    }

    if (saveNormResult.isError) {
      setShowErrorAlert(true);
      setTimeout(() => setShowErrorAlert(false), 3000);
    }
  }, [saveNormResult]);

  const toggleElement = (index: number) => {
    setExpandedElements((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const toggleSelectedElement = (id: unknown) => {
    const elementId = id as string;
    setSelectedElements((prev) =>
      prev.includes(elementId)
        ? prev.filter((subId) => subId !== elementId)
        : [...prev, elementId],
    );
  };

  const handleRemoveElement = (index: number) => {
    setFormData((prevData) => ({
      ...prevData,
      elements: prevData.elements.filter((_, i) => i !== index),
    }));
  };

  const handleEditItem = (index: number) => {
    handleDisableEdit(true);
    handleShowAddElement(true);
    handleShowAddElementButton(false);
    handleEditingElement(index);
  };

  const objectToFormData = (data: NormData): FormData => {
    const formData = new FormData();

    // Append top-level fields
    formData.append("name", data.name!);
    formData.append("version", data.version);
    formData.append("country", data.country!.toString());
    formData.append("normFile", data.normFile!);
    formData.append("id", data.id ? data.id.toString() : "");

    // Append elements
    data.elements.forEach((element, elementIndex) => {
      if (element.id) {
        formData.append(`elements[${elementIndex}].id`, element.id.toString());
      }
      formData.append(
        `elements[${elementIndex}].subType`,
        element.subType?.toString() || "",
      );
      formData.append(
        `elements[${elementIndex}].sapReference`,
        element.sapReference,
      );
      formData.append(
        `elements[${elementIndex}].specialItem`,
        element.specialItem?.toString() || "",
      );

      element.values.forEach((value, valueIndex) => {
        // Use the nested structure as specified
        const formattedKey = `elements[${elementIndex}].values[${valueIndex}]`;

        // Append the properties of the value
        formData.append(`${formattedKey}.key`, value.key);
        formData.append(`${formattedKey}.name`, value.name);
        formData.append(`${formattedKey}.type`, value.type);

        // Append the value based on its type
        if (value.type === "file" && value.value instanceof File) {
          formData.append(`${formattedKey}.value`, value.value); // Append the File
        } else if (value.type === "object") {
          formData.append(`${formattedKey}.value`, JSON.stringify(value.value)); // Append string value
        } else {
          formData.append(`${formattedKey}.value`, value.value!.toString());
        }
      });
    });

    return formData;
  };

  const handleSaveNorm = () => {
    const formaDataTransformed = objectToFormData(formData);
    saveNorm(formaDataTransformed);
  };

  const renderValue = (
    value: unknown,
    type: string,
  ): string | number | JSX.Element => {
    if (type === "string" || type === "text" || value instanceof String) {
      return value as string;
    } else if (type === "number" || value instanceof Number) {
      return value as number;
    } else if (type === "file") {
      if (value instanceof File) {
        return <FileUpload initialFile={value} disabled />;
      } else {
        return (
          <FileUpload
            existingFileUrl={`http://localhost:3000/${value}`}
            disabled
          />
        );
      }
    } else {
      if (value !== undefined) {
        try {
          return <AccesoriesTable accessories={value as Accessory[]} />;
        } catch {
          return "Invalid Value";
        }
      }
    }
    return "Unknown Value";
  };

  const toogleAccessoryModal = () =>
    setAccessoryModalIsOpen(!accessoryModalIsOpen);

  const mapElementsToCheckList = (elements: NormElement[]) => {
    const elementsTransformed = elements.map((element, index) => ({
      id: element.sapReference,
      description: `Elemento ${index + 1}`,
      reference: element.sapReference,
    }));

    return elementsTransformed;
  };

  const handleNextStep = () => {
    setStep((prevStep) => prevStep + 1);
  };

  const addAccessoryToElement = (
    elements: NormElement[],
    newAccessory: object,
  ) => {
    selectedElements.forEach((elementId) => {
      const element = elements.find((el) => el.sapReference === elementId);

      if (!element) return;

      const accessoriesField = element.values.find(
        (v) => v.key === "accesories",
      );

      if (accessoriesField) {
        if (Array.isArray(accessoriesField.value)) {
          const exists = accessoriesField.value.some(
            (acc) => JSON.stringify(acc) === JSON.stringify(newAccessory),
          );
          if (!exists) {
            accessoriesField.value = [...accessoriesField.value, newAccessory];
          }
        }
      } else {
        element.values.push({
          key: "accesories",
          name: "Accesorios",
          sapReference: false,
          validations: {},
          descriptionInfo: "Accesorios del elemento",
          value: [newAccessory],
          type: "object",
        });
      }
    });
  };

  const filterAccesoriesByIds = (ids: number[]): Accessory[] => {
    const filteredAccesories = accessoriesData
      .filter((subItem) => ids.includes(subItem.id))
      .map((subItem, index) => {
        const base = { ...subItem, value: subItem.value ?? 1 };
        if (index === 0) {
          return { ...base, semiFinished: selectedSemiFinished };
        }
        return base;
      });
    return filteredAccesories;
  };

  const handleAddAccesory = () => {
    addAccessoryToElement(
      formData.elements,
      filterAccesoriesByIds(selectedSubItems)[0],
    );
    toogleAccessoryModal();
    setSelectedSubItems([]);
    setAccessoriesData([]);
    setStep(0);
    setSelectedSemiFinished(undefined);
  };

  const handleCancel = () => {
    setSelectedElements([]);
    setSelectedSemiFinished(undefined);
    toogleAccessoryModal();
    setSelectedSubItems([]);
    setAccessoriesData([]);
    setStep(0);
  };

  const handleSelectAllElements = (ids: unknown[]) => {
    setSelectedElements(ids as string[]);
  };

  const stepComponents: Record<
    number,
    { title?: string; content: JSX.Element; isFinalStep?: boolean }
  > = {
    0: {
      content: (
        <CheckboxList
          items={mapElementsToCheckList(formData.elements)}
          selectedItems={selectedElements}
          toggleItem={toggleSelectedElement}
          labelFieldKey="description"
          additionalFieldKey="reference"
          selectAll={handleSelectAllElements}
          title="los elementos"
          multipleItems
        />
      ),
      isFinalStep: false,
    },
    1: {
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
    2: {
      title: "Selecciona el semi elaborado",
      content: (
        <SemiFinished setSelectedSemiFinished={setSelectedSemiFinished} />
      ),
      isFinalStep: true,
    },
  };

  return (
    <>
      <div>
        <div className="space-y-3">
          {formData.elements.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
              Todavía no hay elementos. Completa los datos generales y pulsa
              «Agregar elemento», o parte de uno ya registrado con «Cargar desde
              existente».
            </p>
          )}
          {formData.elements.length > 0 && (
            <>
              <div className="flex justify-end">
                <Button
                  base
                  size="sm"
                  onClick={toogleAccessoryModal}
                  icon={<FaPlus />}
                >
                  Agregar accesorio
                </Button>
              </div>
              {formData.elements.map((element, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleElement(index)}
                      className="flex items-center text-left font-medium text-gray-900"
                    >
                      <span
                        className={`text-xs text-gray-400 transition-transform ${
                          expandedElements.includes(index) ? "rotate-90" : ""
                        }`}
                      >
                        ▶
                      </span>
                      <span className="ml-2">Elemento {index + 1}</span>
                      {element.subTypeName && (
                        <span className="ml-3 font-normal text-gray-500">
                          {element.subTypeName}
                        </span>
                      )}
                      {element.sapReference && (
                        <span className="ml-3 font-mono text-xs font-normal text-gray-500">
                          {element.sapReference}
                        </span>
                      )}
                    </button>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Editar elemento"
                        aria-label={`Editar elemento ${index + 1}`}
                        className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-rymel-blue disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => handleEditItem(index)}
                        disabled={disableEdit}
                      >
                        <BiEdit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Quitar elemento"
                        aria-label={`Quitar elemento ${index + 1}`}
                        className="rounded p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => handleRemoveElement(index)}
                        disabled={disableEdit}
                      >
                        <BiTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {expandedElements.includes(index) && (
                    <div className="mt-3 border-t border-gray-100 pt-3 text-gray-700">
                      <h4 className="font-medium">
                        Sub Tipo: {element.subTypeName}
                      </h4>
                      <h4 className="font-medium mt-2">Valores:</h4>
                      <ul className="list-disc space-y-1 pl-5">
                        {element.values.map((value, vIndex) => (
                          <li key={vIndex}>
                            <span className="font-medium">{value.name}:</span>{" "}
                            {renderValue(value.value, value.type)}
                            <span className="ml-2 text-xs text-gray-400">
                              ({value.type})
                            </span>
                          </li>
                        ))}
                        <li>
                          <span className="font-medium">Referencia ERP:</span>{" "}
                          {element.sapReference}
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              ))}
              {/* Guardar siempre a la vista, por larga que sea la página. */}
              <SelectionBar
                count={formData.elements.length}
                label={
                  formData.elements.length === 1
                    ? "elemento cargado"
                    : "elementos cargados"
                }
                actions={
                  <Button
                    variant="accent"
                    size="lg"
                    loading={saveNormResult.isLoading}
                    onClick={handleSaveNorm}
                    icon={<LuSave />}
                    disabled={disableEdit}
                  >
                    Guardar norma
                  </Button>
                }
              />
            </>
          )}
        </div>
      </div>
      {showErrorAlert && <Alert error message="Error guardando la norma!" />}
      {showSuccessAlert && (
        <Alert success message="Norma guardada exitosamente!" />
      )}
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
    </>
  );
};

export default NormInformation;
