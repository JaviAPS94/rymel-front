import React from "react";
import Button from "../core/Button";
import { FaPlus, FaXmark, FaPenRuler } from "react-icons/fa6";
import { IoLibraryOutline } from "react-icons/io5";

interface FormulaBarProps {
  selectedCell: string;
  currentSheetName: string;
  formulaInput: string;
  isFormulaBuildingMode: boolean;
  isAddingToFormula: boolean;
  rangeSelectionStart: string | null;
  formulaCursorPosition: number;
  formulaInputRef: React.RefObject<HTMLInputElement | null>;
  onFormulaChange: (value: string) => void;
  onFormulaKeyPress: (e: React.KeyboardEvent) => void;
  onFormulaFocus: () => void;
  onFormulaBlur: () => void;
  updateCursorPosition: () => void;
  onShowFunctionLibrary: () => void;
  onToggleAddingToFormula: () => void;
  onHandleRangeSelection: () => void;
  onExitFormulaBuildingMode: () => void;
  styleToolbar?: React.ReactNode;
}

const FormulaBar: React.FC<FormulaBarProps> = ({
  selectedCell,
  currentSheetName,
  formulaInput,
  isFormulaBuildingMode,
  isAddingToFormula,
  rangeSelectionStart,
  formulaCursorPosition,
  formulaInputRef,
  onFormulaChange,
  onFormulaKeyPress,
  onFormulaFocus,
  onFormulaBlur,
  updateCursorPosition,
  onShowFunctionLibrary,
  onToggleAddingToFormula,
  onHandleRangeSelection,
  onExitFormulaBuildingMode,
  styleToolbar,
}) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
          - Celda: {selectedCell}
        </span>
        <input
          ref={formulaInputRef}
          type="text"
          value={formulaInput}
          onChange={(e) => onFormulaChange(e.target.value)}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          onSelect={updateCursorPosition}
          onKeyDown={onFormulaKeyPress}
          onFocus={onFormulaFocus}
          onBlur={onFormulaBlur}
          placeholder="Ingrese un valor o una fórmula (e.g., =A1+B1, =Sheet1!A1, =design:Sheet1!A1, =cost:Hoja1!A1)"
          className={`flex-1 px-2 py-0.5 h-7 border rounded text-sm focus:outline-none focus:ring-2 ${
            isFormulaBuildingMode
              ? "border-rymel-indigo focus:ring-rymel-indigo bg-rymel-tint"
              : "border-gray-300 focus:ring-rymel-indigo"
          }`}
        />
      </div>
      {/* Cell Style Toolbar */}
      {styleToolbar}
      {isFormulaBuildingMode && (
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-rymel-blue font-medium text-xs">
            Modo Formula
          </span>
          <span className="text-xs text-gray-400">
            Cursor: {formulaCursorPosition}
          </span>
          <Button
            base
            size="sm"
            onClick={onShowFunctionLibrary}
            icon={<IoLibraryOutline />}
          >
            Funciones
          </Button>
          <Button
            onClick={onToggleAddingToFormula}
            base
            size="sm"
            active={isAddingToFormula}
            icon={isAddingToFormula ? <FaXmark /> : <FaPlus />}
          >
            {isAddingToFormula
              ? "Haga clic en celdas (puede cambiar de hoja)"
              : "Agregar celda"}
          </Button>
          <Button
            onClick={onHandleRangeSelection}
            base
            size="sm"
            active={Boolean(rangeSelectionStart)}
            icon={<FaPenRuler />}
          >
            {rangeSelectionStart ? `Rango: ${rangeSelectionStart}:?` : "Rango"}
          </Button>
          <Button
            outline
            size="sm"
            onClick={onExitFormulaBuildingMode}
            icon={<FaXmark />}
          >
            Salir
          </Button>
        </div>
      )}
    </div>
  );
};

export default React.memo(FormulaBar);
