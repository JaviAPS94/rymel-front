import React, { useState } from "react";

interface GraphicsHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertGraphic: (graphicString: string) => void;
}

const GraphicsHelperModal: React.FC<GraphicsHelperModalProps> = ({
  isOpen,
  onClose,
  onInsertGraphic,
}) => {
  const [shapeType, setShapeType] = useState<"rectangle" | "circle" | "line">(
    "rectangle",
  );
  const [posX, setPosX] = useState("0");
  const [posY, setPosY] = useState("0");
  const [width, setWidth] = useState("100");
  const [height, setHeight] = useState("100");
  const [diameter, setDiameter] = useState("50");
  const [length, setLength] = useState("100");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#4A90E2");

  if (!isOpen) return null;

  const handleInsert = () => {
    let graphicString = "";

    if (shapeType === "rectangle") {
      graphicString = `GRAPHIC:rectangle:${posX}:${posY}:${width}:${height}:${label}:${color}`;
    } else if (shapeType === "circle") {
      graphicString = `GRAPHIC:circle:${posX}:${posY}:${diameter}:0:${label}:${color}`;
    } else if (shapeType === "line") {
      graphicString = `GRAPHIC:line:${posX}:${posY}:${length}:0:${label}:${color}`;
    }

    onInsertGraphic(graphicString);
    onClose();
  };

  const presetColors = [
    "#4A90E2",
    "#E24A4A",
    "#4AE290",
    "#E2C44A",
    "#9B4AE2",
    "#4AE2E2",
    "#E2904A",
    "#888888",
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Insert Graphic Shape</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Shape Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shape Type
            </label>
            <div className="flex gap-2">
              <button
                className={`flex-1 py-3 px-4 rounded-md border-2 transition-colors ${
                  shapeType === "rectangle"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onClick={() => setShapeType("rectangle")}
              >
                <div className="text-2xl mb-1">▭</div>
                <div className="text-sm font-medium">Rectangle</div>
              </button>
              <button
                className={`flex-1 py-3 px-4 rounded-md border-2 transition-colors ${
                  shapeType === "circle"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onClick={() => setShapeType("circle")}
              >
                <div className="text-2xl mb-1">●</div>
                <div className="text-sm font-medium">Circle</div>
              </button>
              <button
                className={`flex-1 py-3 px-4 rounded-md border-2 transition-colors ${
                  shapeType === "line"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onClick={() => setShapeType("line")}
              >
                <div className="text-2xl mb-1">─</div>
                <div className="text-sm font-medium">Line</div>
              </button>
            </div>
          </div>

          {/* Position */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position X
              </label>
              <input
                type="text"
                value={posX}
                onChange={(e) => setPosX(e.target.value)}
                placeholder="0 or cell ref (e.g., A1)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position Y
              </label>
              <input
                type="text"
                value={posY}
                onChange={(e) => setPosY(e.target.value)}
                placeholder="0 or cell ref (e.g., B1)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Dimensions */}
          {shapeType === "rectangle" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Width
                </label>
                <input
                  type="text"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="100 or cell ref (e.g., C1)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height
                </label>
                <input
                  type="text"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="100 or cell ref (e.g., D1)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {shapeType === "circle" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Diameter
              </label>
              <input
                type="text"
                value={diameter}
                onChange={(e) => setDiameter(e.target.value)}
                placeholder="50 or cell ref (e.g., C1)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {shapeType === "line" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Length
              </label>
              <input
                type="text"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                placeholder="100 or cell ref (e.g., C1)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label (Optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Shape"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex gap-2 mb-2">
              {presetColors.map((presetColor) => (
                <button
                  key={presetColor}
                  className={`w-10 h-10 rounded-md border-2 transition-all ${
                    color === presetColor
                      ? "border-gray-900 scale-110"
                      : "border-gray-300 hover:scale-105"
                  }`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => setColor(presetColor)}
                />
              ))}
            </div>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#4A90E2"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Preview */}
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Formula Preview:
            </div>
            <code className="block bg-white p-3 rounded border border-gray-200 text-sm font-mono break-all">
              {shapeType === "rectangle" &&
                `GRAPHIC:rectangle:${posX}:${posY}:${width}:${height}:${label}:${color}`}
              {shapeType === "circle" &&
                `GRAPHIC:circle:${posX}:${posY}:${diameter}:0:${label}:${color}`}
              {shapeType === "line" &&
                `GRAPHIC:line:${posX}:${posY}:${length}:0:${label}:${color}`}
            </code>
          </div>

          {/* Help Text */}
          <div className="bg-blue-50 p-4 rounded-md text-sm text-gray-700">
            <p className="font-medium mb-1">💡 Tip:</p>
            <p>
              You can use cell references for any dimension value. For example,
              use "A1" instead of "100" to get the width from cell A1. The
              graphic will update automatically when the cell value changes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Insert Graphic
          </button>
        </div>
      </div>
    </div>
  );
};

export default GraphicsHelperModal;
