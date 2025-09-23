"use client";

import { useState } from "react";
import DesignViewer from "../components/design/DesignViewer";
import DesignList from "../components/design/DesignList";

const designsData = [
  {
    id: 13,
    name: "Nuevo diseño",
    code: "DESIGN_1757381545773",
    createdAt: "2025-09-09T06:32:25.873Z",
    updatedAt: "2025-09-09T06:32:25.873Z",
    deletedAt: null,
    designSubType: {
      id: 1,
      name: "1F",
      createdAt: "2025-05-01T07:00:44.153Z",
      updatedAt: "2025-05-01T07:00:44.153Z",
      deletedAt: null,
      designType: {
        id: 1,
        name: "Convencionales",
        createdAt: "2025-05-01T07:00:06.470Z",
        updatedAt: "2025-05-01T07:00:06.470Z",
        deletedAt: null,
      },
    },
    designElements: [
      {
        id: 20,
        createdAt: "2025-09-09T06:32:25.933Z",
        updatedAt: "2025-09-09T06:32:25.933Z",
        deletedAt: null,
        element: {
          id: 2014,
          values:
            '[{"key":"phases","name":"Fases","type":"number","value":"1"},{"key":"power","name":"Potencia [kVA]","type":"number","value":"100"},{"key":"primaryVoltage","name":"Voltaje Primario [V]","type":"number","value":"100"},{"key":"secondaryVoltage","name":"Voltaje secundario [V]","type":"string","value":"100"},{"key":"connection","name":"Conexión","type":"string","value":"CGT"},{"key":"specification","name":"Especificación","type":"string","value":"ST"}]',
          sapReference: "1-100-100-100-CV-CGT-NTCA-CO-ST",
          createdAt: "2025-03-18T08:49:10.953Z",
          updatedAt: "2025-03-18T08:49:10.953Z",
          deletedAt: null,
          norm: {
            id: 2020,
            name: "NTCA",
            version: "1234",
            normFile: "uploads/normFile-1742269750784-240470846.docx",
            createdAt: "2025-03-18T08:49:10.920Z",
            updatedAt: "2025-03-18T08:49:10.920Z",
            deletedAt: null,
            country: {
              id: 1002,
              name: "Colombia",
              isoCode: "CO",
              createdAt: "2024-12-16T04:00:28.450Z",
              updatedAt: "2024-12-16T04:00:28.450Z",
              deletedAt: null,
            },
          },
        },
      },
      {
        id: 21,
        createdAt: "2025-09-09T06:32:25.943Z",
        updatedAt: "2025-09-09T06:32:25.943Z",
        deletedAt: null,
        element: {
          id: 2015,
          values:
            '[{"key":"phases","name":"Fases","type":"number","value":"3"},{"key":"power","name":"Potencia [kVA]","type":"number","value":"100"},{"key":"primaryVoltage","name":"Voltaje Primario [V]","type":"number","value":"100"},{"key":"secondaryVoltage","name":"Voltaje secundario [V]","type":"string","value":"100"},{"key":"connection","name":"Conexión","type":"string","value":"CTY"},{"key":"specification","name":"Especificación","type":"string","value":"ST"}]',
          sapReference: "3-100-100-100-CV-CTY-NTCA-CO-ST",
          createdAt: "2025-03-18T08:57:24.870Z",
          updatedAt: "2025-03-18T08:57:24.870Z",
          deletedAt: null,
          norm: {
            id: 2021,
            name: "NTCA",
            version: "1.0.0",
            normFile: "uploads/normFile-1742270244766-841147651.docx",
            createdAt: "2025-03-18T08:57:24.850Z",
            updatedAt: "2025-03-18T08:57:24.850Z",
            deletedAt: null,
            country: {
              id: 1002,
              name: "Colombia",
              isoCode: "CO",
              createdAt: "2024-12-16T04:00:28.450Z",
              updatedAt: "2024-12-16T04:00:28.450Z",
              deletedAt: null,
            },
          },
        },
      },
    ],
    subDesigns: [
      {
        id: 18,
        name: "Template 1F",
        code: "sheet1",
        data: '{"id":"sheet1","name":"Template 1F","cells":{"A1":{"value":"Análisis Cuadrático","formula":"Análisis Cuadrático","computed":"Análisis Cuadrático"},"A2":{"value":"f(x) = ax² + bx + c","formula":"f(x) = ax² + bx + c","computed":"f(x) = ax² + bx + c"}}}',
        createdAt: "2025-09-09T06:32:25.953Z",
        updatedAt: "2025-09-09T06:32:25.953Z",
        deletedAt: null,
      },
      {
        id: 19,
        name: "Template 1F",
        code: "sheet1757381469555",
        data: '{"id":"sheet1757381469555","name":"Template 1F"}',
        createdAt: "2025-09-09T06:32:26.020Z",
        updatedAt: "2025-09-09T06:32:26.020Z",
        deletedAt: null,
      },
      {
        id: 20,
        name: "Template 1F",
        code: "sheet1757381528023",
        data: '{"id":"sheet1757381528023","name":"Template 1F"}',
        createdAt: "2025-09-09T06:32:26.036Z",
        updatedAt: "2025-09-09T06:32:26.036Z",
        deletedAt: null,
      },
    ],
  },
  {
    id: 14,
    name: "Diseño Industrial",
    code: "DESIGN_1757381545774",
    createdAt: "2025-09-08T10:15:30.123Z",
    updatedAt: "2025-09-08T14:22:15.456Z",
    deletedAt: null,
    designSubType: {
      id: 2,
      name: "3F",
      createdAt: "2025-05-01T07:00:44.153Z",
      updatedAt: "2025-05-01T07:00:44.153Z",
      deletedAt: null,
      designType: {
        id: 2,
        name: "Industriales",
        createdAt: "2025-05-01T07:00:06.470Z",
        updatedAt: "2025-05-01T07:00:06.470Z",
        deletedAt: null,
      },
    },
    designElements: [
      {
        id: 22,
        createdAt: "2025-09-08T10:15:30.200Z",
        updatedAt: "2025-09-08T10:15:30.200Z",
        deletedAt: null,
        element: {
          id: 2016,
          values:
            '[{"key":"phases","name":"Fases","type":"number","value":"3"},{"key":"power","name":"Potencia [kVA]","type":"number","value":"500"},{"key":"primaryVoltage","name":"Voltaje Primario [V]","type":"number","value":"13800"},{"key":"secondaryVoltage","name":"Voltaje secundario [V]","type":"string","value":"480"},{"key":"connection","name":"Conexión","type":"string","value":"DY"},{"key":"specification","name":"Especificación","type":"string","value":"IND"}]',
          sapReference: "3-500-13800-480-IND-DY-NTCA-CO-IND",
          createdAt: "2025-03-18T08:49:10.953Z",
          updatedAt: "2025-03-18T08:49:10.953Z",
          deletedAt: null,
          norm: {
            id: 2020,
            name: "NTCA",
            version: "1234",
            normFile: "uploads/normFile-1742269750784-240470846.docx",
            createdAt: "2025-03-18T08:49:10.920Z",
            updatedAt: "2025-03-18T08:49:10.920Z",
            deletedAt: null,
            country: {
              id: 1002,
              name: "Colombia",
              isoCode: "CO",
              createdAt: "2024-12-16T04:00:28.450Z",
              updatedAt: "2024-12-16T04:00:28.450Z",
              deletedAt: null,
            },
          },
        },
      },
    ],
    subDesigns: [
      {
        id: 21,
        name: "Template Industrial",
        code: "sheet_industrial_001",
        data: '{"id":"sheet_industrial_001","name":"Template Industrial"}',
        createdAt: "2025-09-08T10:15:30.300Z",
        updatedAt: "2025-09-08T10:15:30.300Z",
        deletedAt: null,
      },
    ],
  },
  {
    id: 15,
    name: "Transformador Residencial",
    code: "DESIGN_1757381545775",
    createdAt: "2025-09-07T16:45:12.789Z",
    updatedAt: "2025-09-07T18:30:45.123Z",
    deletedAt: null,
    designSubType: {
      id: 1,
      name: "1F",
      createdAt: "2025-05-01T07:00:44.153Z",
      updatedAt: "2025-05-01T07:00:44.153Z",
      deletedAt: null,
      designType: {
        id: 1,
        name: "Convencionales",
        createdAt: "2025-05-01T07:00:06.470Z",
        updatedAt: "2025-05-01T07:00:06.470Z",
        deletedAt: null,
      },
    },
    designElements: [
      {
        id: 23,
        createdAt: "2025-09-07T16:45:12.850Z",
        updatedAt: "2025-09-07T16:45:12.850Z",
        deletedAt: null,
        element: {
          id: 2017,
          values:
            '[{"key":"phases","name":"Fases","type":"number","value":"1"},{"key":"power","name":"Potencia [kVA]","type":"number","value":"25"},{"key":"primaryVoltage","name":"Voltaje Primario [V]","type":"number","value":"7200"},{"key":"secondaryVoltage","name":"Voltaje secundario [V]","type":"string","value":"240"},{"key":"connection","name":"Conexión","type":"string","value":"H1X1"},{"key":"specification","name":"Especificación","type":"string","value":"RES"}]',
          sapReference: "1-25-7200-240-CV-H1X1-NTCA-CO-RES",
          createdAt: "2025-03-18T08:49:10.953Z",
          updatedAt: "2025-03-18T08:49:10.953Z",
          deletedAt: null,
          norm: {
            id: 2020,
            name: "NTCA",
            version: "1234",
            normFile: "uploads/normFile-1742269750784-240470846.docx",
            createdAt: "2025-03-18T08:49:10.920Z",
            updatedAt: "2025-03-18T08:49:10.920Z",
            deletedAt: null,
            country: {
              id: 1002,
              name: "Colombia",
              isoCode: "CO",
              createdAt: "2024-12-16T04:00:28.450Z",
              updatedAt: "2024-12-16T04:00:28.450Z",
              deletedAt: null,
            },
          },
        },
      },
    ],
    subDesigns: [],
  },
];

export default function Home() {
  const [selectedDesign, setSelectedDesign] = useState<
    (typeof designsData)[0] | null
  >(null);

  const handleSelectDesign = (design: (typeof designsData)[0]) => {
    setSelectedDesign(design);
  };

  const handleBackToList = () => {
    setSelectedDesign(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {selectedDesign ? (
          <div>
            <button
              onClick={handleBackToList}
              className="mb-6 flex items-center text-rymel-blue hover:text-blue-800 transition-colors"
            >
              <span className="mr-2">←</span>
              Volver al catálogo
            </button>
            <DesignViewer design={selectedDesign} />
          </div>
        ) : (
          <DesignList
            designs={designsData}
            onSelectDesign={handleSelectDesign}
          />
        )}
      </div>
    </main>
  );
}
