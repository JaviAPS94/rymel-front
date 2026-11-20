import CountryFlag from "../core/CountryFlag";
import { TbCalculator, TbFileText, TbTrash } from "react-icons/tb";
import React, { useEffect, useState } from "react";
import { Design, DesignElement } from "../../commons/types";
import Button from "../core/Button";
import { FaCheck, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { Modal } from "../core/Modal";
import { useDeleteByIdMutation } from "../../store";
import { useAlert } from "../../hooks/useAlert";
import Alert from "../core/Alert";
import { PageHeader, HeaderChip, Page } from "@rymel/ui";

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
      value.value as string,
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
      designElement.element.values as unknown as string,
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

  const norm = design.designElements[0]?.element.norm;
  const tabs = [
    { key: "overview", label: "Resumen" },
    {
      key: "elements",
      label: "Elementos",
      count: design.designElements.length,
    },
    {
      key: "subdesigns",
      label: "Sub-diseños",
      count: design.subDesigns.length,
    },
  ] as const;

  const facts: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: "ID", value: design.id },
    { label: "Código", value: design.code, mono: true },
    { label: "Nombre", value: design.name },
    { label: "Tipo", value: design.designSubType.designType.name },
    { label: "Subtipo", value: design.designSubType.name },
    { label: "Norma", value: norm?.name ?? "—" },
    {
      label: "País",
      value: norm ? (
        <span className="flex items-center gap-2.5">
          <CountryFlag
            isoCode={norm.country.isoCode}
            className="h-4 w-6 rounded-[3px] object-cover"
          />
          {norm.country.name}
        </span>
      ) : (
        "—"
      ),
    },
    { label: "Elementos", value: design.designElements.length },
    { label: "Sub-diseños", value: design.subDesigns.length },
  ];

  return (
    <>
      <PageHeader
        icon={<TbFileText />}
        back={{ label: "Volver al catálogo", onClick: handleBackToList }}
        title={design.name}
        meta={
          <>
            <HeaderChip mono>{design.code}</HeaderChip>
            <HeaderChip>{design.designSubType.designType.name}</HeaderChip>
            <HeaderChip>Subtipo {design.designSubType.name}</HeaderChip>
          </>
        }
        actions={
          <>
            <Button
              variant="dangerLight"
              size="lg"
              icon={<TbTrash className="h-[17px] w-[17px]" />}
              onClick={handleDeleteDesign}
            >
              Eliminar
            </Button>
            <Button
              variant="light"
              size="lg"
              className="!shadow-none"
              icon={<TbCalculator className="h-[18px] w-[18px]" />}
              onClick={() => handleViewDesignCalculations(design.id)}
            >
              Ver cálculos
            </Button>
          </>
        }
      />

      <Page>
        <section className="overflow-hidden rounded-[20px] border bg-white">
          <div
            role="tablist"
            aria-label="Secciones del diseño"
            className="flex gap-1 overflow-x-auto border-b border-[#EFEEF5] px-6"
          >
            {tabs.map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex h-[60px] items-center gap-2 whitespace-nowrap border-b-[3px] px-4 text-[15px] transition-colors ${
                    selected
                      ? "border-rymel-blue font-bold text-rymel-blue"
                      : "border-transparent font-semibold text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab.label}
                  {"count" in tab && (
                    <span className="rounded-full bg-gray-100 px-2 py-px text-xs font-bold">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-5 sm:p-7">
            {activeTab === "overview" && (
              <div className="flex flex-wrap gap-6">
                <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
                  <h2 className="m-0 text-lg font-extrabold">
                    Información general
                  </h2>
                  <dl className="m-0 grid grid-cols-1 overflow-hidden rounded-2xl border border-[#EFEEF5] sm:grid-cols-3">
                    {facts.map((fact) => (
                      <div
                        key={fact.label}
                        className="-mb-px -mr-px flex flex-col gap-1.5 border-b border-r border-[#EFEEF5] px-5 py-[18px]"
                      >
                        <dt className="text-[13px] font-semibold text-gray-600">
                          {fact.label}
                        </dt>
                        <dd
                          className={`m-0 font-bold text-gray-900 ${
                            fact.mono ? "font-mono text-[15px]" : "text-base"
                          }`}
                        >
                          {fact.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 rounded-2xl bg-rymel-blue p-5 text-white">
                      <span className="text-[40px] font-extrabold leading-none text-rymel-yellow">
                        {design.designElements.length}
                      </span>
                      <span className="text-sm font-semibold text-white/85">
                        Elementos
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-2xl bg-rymel-soft p-5 text-rymel-blue">
                      <span className="text-[40px] font-extrabold leading-none">
                        {design.subDesigns.length}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">
                        Sub-diseños
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 rounded-2xl border border-[#EFEEF5] p-5">
                    <h2 className="m-0 text-base font-extrabold">Fechas</h2>
                    {[
                      {
                        label: "Creado",
                        date: design.createdAt,
                        dot: "bg-rymel-blue",
                      },
                      {
                        label: "Actualizado",
                        date: design.updatedAt,
                        dot: "bg-rymel-yellow shadow-[0_0_0_1px_#B8962A]",
                      },
                    ].map((entry) => (
                      <div key={entry.label} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className={`mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full ${entry.dot}`}
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-semibold text-gray-600">
                            {entry.label}
                          </span>
                          <span className="text-[15px] font-bold">
                            {formatDate(entry.date)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            )}

            {activeTab === "elements" && (
              <div className="space-y-6">
                <h2 className="m-0 text-lg font-extrabold">
                  Elementos del diseño
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {design.designElements.map((designElement, index) => {
                    return (
                      <div
                        key={designElement.id}
                        className="rounded-2xl border border-gray-300 p-5"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-base font-extrabold text-gray-900">
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
                                  Referencia ERP:
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
                  <h2 className="m-0 text-lg font-extrabold">Sub-diseños</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {design.subDesigns.map((subDesign) => (
                    <div
                      key={subDesign.id}
                      className="rounded-2xl border border-gray-300 p-5 transition-shadow hover:shadow-float"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-extrabold text-gray-900">
                          {subDesign.name}
                        </h4>
                        <span className="rounded-full bg-rymel-soft px-2.5 py-1 text-xs font-bold text-rymel-indigo">
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
        </section>
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
            <Button base onClick={handleDeleteDesign} icon={<FaTimes />}>
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
      </Page>
    </>
  );
}
