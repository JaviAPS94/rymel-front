import { useEffect, useState } from "react";
import { Design, DesignElement } from "../../commons/types";
import Button from "../core/Button";
import { FaCheck, FaEye, FaRegTrashAlt, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { Modal } from "../core/Modal";
import { useDeleteByIdMutation } from "../../store";
import { useAlert } from "../../hooks/useAlert";
import Alert from "../core/Alert";
import { MdOutlineDesignServices } from "react-icons/md";

interface DesignViewerProps {
  design: Design;
  handleBackToList: () => void;
}
interface TechnicalValue {
  type: string;
  name: string;
  value: string | unknown;
  id?: string;
  description?: string;
}

export default function DesignViewer({
  design,
  handleBackToList,
}: DesignViewerProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "elements" | "subdesigns"
  >("overview");
  const [showDeleteDesignModal, setShowDeleteDesignModal] =
    useState<boolean>(false);
  const { alert, showAlert, hideAlert } = useAlert();
  const navigate = useNavigate();
  const [deleteById, deleteByIdResult] = useDeleteByIdMutation();

  useEffect(() => {
    if (deleteByIdResult.isSuccess) {
      deleteByIdResult.reset();
      showAlert("Diseño eliminado correctamente.", "success");
      setTimeout(() => {
        handleBackToList();
      }, 3000);
    }
    if (deleteByIdResult.isError) {
      deleteByIdResult.reset();
      showAlert("Error al eliminar el diseño. Inténtelo de nuevo.", "error");
    }
  }, [deleteByIdResult, showAlert, handleBackToList]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const parseElementValues = (valuesString: string) => {
    try {
      return JSON.parse(valuesString);
    } catch {
      return [];
    }
  };

  const handleViewDesignCalculations = (designId: number) => {
    navigate(`/elements/design?designId=${designId}`);
  };

  const renderObjectValue = (value: TechnicalValue, idx: number) => {
    const objValues = parseElementValues(
      value.value as string
    ) as TechnicalValue[];

    return (
      <div key={idx} className="mb-2 text-sm">
        <span className="text-gray-600">{value.name}:</span>
        <ul className="list-disc list-inside mt-1">
          {objValues.map((objValue, objIdx) => (
            <li key={objIdx} className="font-medium">
              <span className="text-gray-600">{objValue.id}:</span>{" "}
              {objValue.name ?? objValue.description}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderSimpleValue = (value: TechnicalValue, idx: number) => (
    <div key={idx} className="flex justify-between text-sm">
      <span className="text-gray-600 font-medium">{value.name}:</span>
      <span className="font-medium">{value.value as string}</span>
    </div>
  );

  const shouldSkipValue = (value: TechnicalValue | null) => {
    return !value || value.type === "file";
  };

  const showTechnicalSpecifications = (designElement: DesignElement) => {
    const values = parseElementValues(
      designElement.element.values as unknown as string
    ) as TechnicalValue[];

    return values
      .map((value, idx) => {
        if (shouldSkipValue(value)) {
          return null;
        }

        switch (value.type) {
          case "object":
            return renderObjectValue(value, idx);
          default:
            return renderSimpleValue(value, idx);
        }
      })
      .filter(Boolean);
  };

  const handleDeleteDesign = () => {
    setShowDeleteDesignModal(!showDeleteDesignModal);
  };

  const confirmDeleteDesign = async () => {
    await deleteById(design.id);
    handleDeleteDesign();
  };

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-rymel-blue text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex">
              <MdOutlineDesignServices className="text-white h-8 w-8" />
              <h1 className="text-3xl font-bold ml-2">{design?.name}</h1>
            </div>
            <p className="text-blue-100 mt-1">Código: {design?.code}</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              primary
              icon={<FaEye />}
              onClick={() => handleViewDesignCalculations(design.id)}
            >
              Ver Cálculos De Diseño
            </Button>
            <Button
              danger
              icon={<FaRegTrashAlt />}
              onClick={handleDeleteDesign}
            >
              Eliminar
            </Button>
            <div className="text-center">
              <div className="bg-rymel-yellow px-3 py-1 rounded-full text-sm">
                {design?.designSubType.designType.name}
              </div>
              <div className="text-blue-100 text-sm mt-1">
                Subtipo: {design?.designSubType.name}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {[
            { key: "overview", label: "Resumen" },
            { key: "elements", label: "Elementos" },
            { key: "subdesigns", label: "Sub-diseños" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() =>
                setActiveTab(tab.key as "overview" | "elements" | "subdesigns")
              }
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "overview" && (
          <div className="grid grid-cols-2 grid-rows-2 gap-4">
            {/* Basic Info */}
            <div className="row-span-2 bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Información General
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">ID:</span>
                  <span className="font-medium">{design?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Código:</span>
                  <span className="font-medium">{design?.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nombre:</span>
                  <span className="font-medium">{design?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium">
                    {design?.designSubType.designType.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtipo:</span>
                  <span className="font-medium">
                    {design?.designSubType.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Elementos:</span>
                  <span className="font-medium">
                    {design?.designElements.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sub-diseños:</span>
                  <span className="font-medium">
                    {design?.subDesigns.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Norma:</span>
                  <span className="font-medium">
                    {design?.designElements[0]?.element.norm.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">País:</span>
                  <span className="font-medium">
                    {design?.designElements[0]?.element.norm.country.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Fechas
              </h3>
              <div className="space-y-2">
                <div>
                  <span className="text-gray-600 block">Creado:</span>
                  <span className="font-medium text-sm">
                    {formatDate(design?.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 block">Actualizado:</span>
                  <span className="font-medium text-sm">
                    {formatDate(design.updatedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex-col justify-center content-center col-start-2 bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Estadísticas Rápidas
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {design.designElements.length}
                  </div>
                  <div className="text-sm text-gray-600">Elementos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {design.subDesigns.length}
                  </div>
                  <div className="text-sm text-gray-600">Sub-diseños</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "elements" && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900">
              Elementos del Diseño
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {design.designElements.map((designElement, index) => {
                return (
                  <div
                    key={designElement.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900">
                        Elemento {index + 1}
                      </h4>
                      <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-mono">
                        ID: {designElement.element.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">
                          Especificaciones Técnicas
                        </h5>
                        <div className="space-y-1">
                          {showTechnicalSpecifications(designElement)}
                        </div>
                      </div>

                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">
                          Información Adicional
                        </h5>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Referencia SAP:
                            </span>
                            <span className="font-mono text-xs">
                              {designElement.element.sapReference}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Norma:</span>
                            <span className="font-medium">
                              {designElement.element.norm.name} v
                              {designElement.element.norm.version}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">País:</span>
                            <span className="font-medium">
                              {designElement.element.norm.country.name} (
                              {designElement.element.norm.country.isoCode})
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "subdesigns" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                Sub-diseños
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {design.subDesigns.map((subDesign) => (
                <div
                  key={subDesign.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">
                      {subDesign.name}
                    </h4>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      ID: {subDesign.id}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Código:</span>
                      <span className="ml-2 font-mono text-xs">
                        {subDesign.code}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Creado:</span>
                      <span className="ml-2">
                        {formatDate(subDesign.createdAt ?? "")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Modal
        isOpen={showDeleteDesignModal}
        onClose={handleDeleteDesign}
        title="Eliminar diseño"
        size="lg"
      >
        <div className="p-4">
          <p>
            Esta acción no se puede deshacer. ¿Está seguro de que desea
            continuar?
          </p>
        </div>
        <div className="flex justify-end p-4">
          <Button onClick={handleDeleteDesign} icon={<FaTimes />}>
            Cancelar
          </Button>
          <Button
            icon={<FaCheck />}
            onClick={confirmDeleteDesign}
            className="ml-2"
            danger
          >
            Confirmar
          </Button>
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
    </div>
  );
}
