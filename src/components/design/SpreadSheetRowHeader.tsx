import React from "react";

interface SpreadSheetRowHeaderProps {
  rowIndex: number;
  rowHeight: number;
  width?: number;
  fontSize?: number;
  onResizeStart: (
    e: React.MouseEvent,
    type: "column" | "row",
    index: number,
    currentSize: number,
  ) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const SpreadSheetRowHeader: React.FC<SpreadSheetRowHeaderProps> = ({
  rowIndex,
  rowHeight,
  width = 48,
  fontSize = 12,
  onResizeStart,
  onContextMenu,
}) => {
  return (
    <div
      className="border-r border-b border-gray-300 flex items-center justify-center font-medium text-gray-700 bg-gray-50 relative group box-border"
      style={{ height: rowHeight, width, minWidth: width, fontSize }}
      onContextMenu={onContextMenu}
    >
      {rowIndex + 1}
      {/* Row resize handle */}
      <div
        className="absolute bottom-0 left-0 w-full h-1 cursor-row-resize bg-transparent hover:bg-blue-400 group-hover:bg-blue-200"
        onMouseDown={(e) => onResizeStart(e, "row", rowIndex, rowHeight)}
        title="Arrastrar para redimensionar fila"
      />
    </div>
  );
};

export default SpreadSheetRowHeader;
