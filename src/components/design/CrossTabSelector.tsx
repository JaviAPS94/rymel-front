import React from "react";
import Select, { Option } from "../core/Select";

interface Sheet {
  id: string;
  name: string;
}

interface InstanceSheets {
  instanceId: string;
  sheets: Sheet[];
}

interface CrossTabSelectorProps {
  allSheets: InstanceSheets[];
  currentInstanceId: string;
  currentSheetId: string;
  selectedTargetInstanceId: string;
  selectedTargetSheetId: string;
  onInstanceChange: (instanceId: string) => void;
  onSheetChange: (sheetId: string) => void;
}

const CrossTabSelector: React.FC<CrossTabSelectorProps> = ({
  allSheets,
  currentInstanceId,
  currentSheetId,
  selectedTargetInstanceId,
  selectedTargetSheetId,
  onInstanceChange,
  onSheetChange,
}) => {
  // Get the selected instance's sheets
  const selectedInstance = allSheets.find(
    (inst) => inst.instanceId === selectedTargetInstanceId,
  );

  // Transform data for Select component
  const instanceOptions: Option<string>[] = allSheets.map((instance) => ({
    label: instance.instanceId === "design" ? "Diseño" : "Costos",
    value: instance.instanceId,
  }));

  const sheetOptions: Option<string>[] =
    selectedInstance?.sheets.map((sheet) => ({
      label: sheet.name,
      value: sheet.id,
    })) || [];

  return (
    <div className="bg-green-50 border border-green-300 rounded-lg p-3 mb-2 shadow-sm mt-5">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-green-700">
          Seleccionar celda de:
        </span>

        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs text-gray-600 font-medium">Pestaña:</label>
          <Select
            options={instanceOptions}
            selectedValue={selectedTargetInstanceId}
            onChange={(value) => value && onInstanceChange(value)}
            isLoading={false}
            placeholder="Seleccionar pestaña"
            className="text-xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs text-gray-600 font-medium">Hoja:</label>
          <Select
            options={sheetOptions}
            selectedValue={selectedTargetSheetId}
            onChange={(value) => value && onSheetChange(value)}
            isLoading={false}
            placeholder="Seleccionar hoja"
            className="text-xs"
          />
        </div>

        <div className="text-xs text-gray-500 ml-auto">
          {selectedTargetInstanceId !== currentInstanceId ||
          selectedTargetSheetId !== currentSheetId ? (
            <span className="text-green-600 font-medium">
              Referencia cruzada activa
            </span>
          ) : (
            <span>Misma hoja</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(CrossTabSelector);
