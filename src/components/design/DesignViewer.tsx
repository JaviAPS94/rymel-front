"use client";

import { useState } from "react";

interface DesignElement {
  id: number;
  element: {
    id: number;
    values: string;
    sapReference: string;
    norm: {
      name: string;
      version: string;
      country: {
        name: string;
        isoCode: string;
      };
    };
  };
}

interface SubDesign {
  id: number;
  name: string;
  code: string;
  data: string;
  createdAt: string;
}

interface Design {
  id: number;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
  designSubType: {
    name: string;
    designType: {
      name: string;
    };
  };
  designElements: DesignElement[];
  subDesigns: SubDesign[];
}

interface DesignViewerProps {
  design: Design;
}

export default function DesignViewer({ design }: DesignViewerProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "elements" | "subdesigns"
  >("overview");

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

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-rymel-blue text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{design.name}</h1>
            <p className="text-blue-100 mt-1">Código: {design.code}</p>
          </div>
          <div className="text-right">
            <div className="bg-rymel-yellow px-3 py-1 rounded-full text-sm">
              {design.designSubType.designType.name}
            </div>
            <div className="text-blue-100 text-sm mt-1">
              Subtipo: {design.designSubType.name}
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
              onClick={() => setActiveTab(tab.key as any)}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Información General
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">ID:</span>
                  <span className="font-medium">{design.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium">
                    {design.designSubType.designType.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtipo:</span>
                  <span className="font-medium">
                    {design.designSubType.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Elementos:</span>
                  <span className="font-medium">
                    {design.designElements.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sub-diseños:</span>
                  <span className="font-medium">
                    {design.subDesigns.length}
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
                    {formatDate(design.createdAt)}
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
            <div className="md:col-span-2 bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Estadísticas Rápidas
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {design.designElements.length}
                  </div>
                  <div className="text-sm text-gray-600">Elementos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {design.subDesigns.length}
                  </div>
                  <div className="text-sm text-gray-600">Sub-diseños</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {design.designElements.reduce((acc, el) => {
                      const values = parseElementValues(el.element.values);
                      const phases = values.find(
                        (v: any) => v.key === "phases"
                      );
                      return acc + (phases ? Number.parseInt(phases.value) : 0);
                    }, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Total Fases</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {design.designElements.reduce((acc, el) => {
                      const values = parseElementValues(el.element.values);
                      const power = values.find((v: any) => v.key === "power");
                      return acc + (power ? Number.parseInt(power.value) : 0);
                    }, 0)}
                  </div>
                  <div className="text-sm text-gray-600">kVA Total</div>
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
            {design.designElements.map((designElement, index) => {
              const values = parseElementValues(designElement.element.values);
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
                        {values.map((value: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-gray-600">{value.name}:</span>
                            <span className="font-medium">{value.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">
                        Información Adicional
                      </h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Referencia SAP:</span>
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
        )}

        {activeTab === "subdesigns" && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900">Sub-diseños</h3>
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
                        {formatDate(subDesign.createdAt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Tipo:</span>
                      <span className="ml-2">Template de análisis</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Ver detalles →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
