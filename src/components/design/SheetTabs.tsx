import React from "react";
import Button from "../core/Button";
import { FaPlus } from "react-icons/fa6";
import { IoMdClose } from "react-icons/io";
import { CellGrid } from "../../commons/types";

interface Sheet {
  id: string;
  name: string;
  cells: CellGrid;
  columnWidths: { [key: number]: number };
  rowHeights: { [key: number]: number };
}

interface SheetTabsProps {
  sheets: Sheet[];
  activeSheetId: string;
  editingSheetName: string | null;
  onSwitchToSheet: (sheetId: string) => void;
  onDeleteSheet: (sheetId: string) => void;
  onSheetNameKeyPress: (e: React.KeyboardEvent, sheetId: string) => void;
  onSetEditingSheetName: (sheetId: string | null) => void;
  onAddNewSheet: () => void;
  selectionStats?: {
    average: number | null;
    count: number;
    sum: number;
  };
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

const SheetTabs: React.FC<SheetTabsProps> = ({
  sheets,
  activeSheetId,
  editingSheetName,
  onSwitchToSheet,
  onDeleteSheet,
  onSheetNameKeyPress,
  onSetEditingSheetName,
  onAddNewSheet,
  selectionStats,
  zoom = 100,
  onZoomChange,
}) => {
  return (
    <div className="bg-gray-50 border-t flex items-center">
      <div className="flex items-center overflow-x-auto">
        {sheets.map((sheet) => (
          <div
            key={sheet.id}
            className={`relative flex items-center min-w-0 ${
              sheet.id === activeSheetId
                ? "bg-white border-t-2 border-blue-500"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {editingSheetName === sheet.id ? (
              <input
                type="text"
                defaultValue={sheet.name}
                className="px-3 py-2 text-sm bg-transparent border-none outline-none min-w-0"
                onKeyDown={(e) => onSheetNameKeyPress(e, sheet.id)}
                onBlur={() => onSetEditingSheetName(null)}
                autoFocus
              />
            ) : (
              <button
                onClick={() => onSwitchToSheet(sheet.id)}
                onDoubleClick={() => onSetEditingSheetName(sheet.id)}
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 min-w-0 truncate"
              >
                {sheet.name}
              </button>
            )}

            {sheets.length > 1 && (
              <Button
                onClick={() => onDeleteSheet(sheet.id)}
                className="border-0 text-red-600"
                title="Eliminar hoja"
              >
                <IoMdClose />
              </Button>
            )}
          </div>
        ))}

        <Button
          onClick={onAddNewSheet}
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 border-l"
          title="Agregar nueva hoja"
        >
          <FaPlus className="inline mr-1 text-blue-600" />
          Agregar Hoja
        </Button>
      </div>

      {/* Flexible spacer */}
      <div className="flex-1"></div>

      {/* Selection Stats - Excel style at the right */}
      {selectionStats && selectionStats.count > 1 && (
        <div className="flex items-center gap-3 px-4 py-2 text-xs bg-white border-l">
          <div className="flex items-center gap-1">
            <span className="font-medium text-gray-600">Average:</span>
            <span className="text-gray-900">
              {selectionStats.average !== null
                ? selectionStats.average.toFixed(2)
                : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-gray-600">Count:</span>
            <span className="text-gray-900">{selectionStats.count}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-gray-600">Sum:</span>
            <span className="text-gray-900">
              {selectionStats.sum.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Zoom slider - Excel style */}
      {onZoomChange && (
        <div className="flex items-center gap-2 px-3 py-1 border-l bg-white select-none">
          <button
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-800 font-bold leading-none"
            onClick={() => onZoomChange(Math.max(50, zoom - 10))}
            title="Reducir zoom"
          >
            −
          </button>
          <input
            type="range"
            min={50}
            max={200}
            step={5}
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="w-24 h-1.5 accent-gray-600 cursor-pointer"
            title={`Zoom: ${zoom}%`}
          />
          <button
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-800 font-bold leading-none"
            onClick={() => onZoomChange(Math.min(200, zoom + 10))}
            title="Aumentar zoom"
          >
            +
          </button>
          <span className="text-xs text-gray-700 w-9 text-right tabular-nums">
            {zoom}%
          </span>
        </div>
      )}
    </div>
  );
};

export default React.memo(SheetTabs);
