import React, { useEffect, useRef, useState } from "react";
import { CellGrid } from "./spreadsheet-types";

interface ComponentDimensions {
  name: string;
  alto: number; // height
  ancho: number; // width
  profundidad?: number; // depth (for Bobina)
  diagonal?: number; // diagonal (for Núcleo)
  diametro?: number; // diameter (for Tanque)
}

interface GraphicsBoardProps {
  cells: CellGrid;
  isVisible: boolean;
}

const GraphicsBoard: React.FC<GraphicsBoardProps> = ({ cells, isVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [components, setComponents] = useState<ComponentDimensions[]>([]);

  // Parse dimension tables from cells
  useEffect(() => {
    const foundComponents: ComponentDimensions[] = [];

    // Helper to get cell value as number
    const getCellValue = (cellRef: string): number => {
      const cell = cells[cellRef];
      const value = cell?.computed || cell?.value || "0";
      const numValue =
        typeof value === "string"
          ? parseFloat(value.replace(",", "."))
          : parseFloat(String(value));
      return isNaN(numValue) ? 0 : numValue;
    };

    // Helper to get cell value as string
    const getCellString = (cellRef: string): string => {
      const cell = cells[cellRef];
      return String(cell?.computed || cell?.value || "").trim();
    };

    // Search for component headers (Núcleo, Bobina, Tanque)
    Object.keys(cells).forEach((cellRef) => {
      const value = getCellString(cellRef);

      if (
        value.toLowerCase().includes("núcleo") ||
        value.toLowerCase().includes("nucleo")
      ) {
        // Found Núcleo, look for dimensions below
        const match = cellRef.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          const col = match[1];
          const row = parseInt(match[2]);

          // Look for Alto, Ancho, Diagonal in following rows
          const component: ComponentDimensions = {
            name: "Núcleo",
            alto: 0,
            ancho: 0,
            diagonal: 0,
          };

          for (let i = 1; i <= 10; i++) {
            const labelCell = `${col}${row + i}`;
            const valueCell =
              String.fromCharCode(col.charCodeAt(0) + 1) + (row + i);
            const label = getCellString(labelCell).toLowerCase();

            if (label.includes("alto")) {
              component.alto = getCellValue(valueCell);
            } else if (label.includes("ancho")) {
              component.ancho = getCellValue(valueCell);
            } else if (label.includes("diagonal")) {
              component.diagonal = getCellValue(valueCell);
            }
          }

          if (component.alto > 0 && component.ancho > 0) {
            foundComponents.push(component);
          }
        }
      } else if (value.toLowerCase().includes("bobina")) {
        // Found Bobina, look for dimensions below
        const match = cellRef.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          const col = match[1];
          const row = parseInt(match[2]);

          const component: ComponentDimensions = {
            name: "Bobina",
            alto: 0,
            ancho: 0,
            profundidad: 0,
          };

          for (let i = 1; i <= 10; i++) {
            const labelCell = `${col}${row + i}`;
            const valueCell =
              String.fromCharCode(col.charCodeAt(0) + 1) + (row + i);
            const label = getCellString(labelCell).toLowerCase();

            if (label.includes("alto")) {
              component.alto = getCellValue(valueCell);
            } else if (label.includes("ancho")) {
              component.ancho = getCellValue(valueCell);
            } else if (label.includes("profundidad")) {
              component.profundidad = getCellValue(valueCell);
            }
          }

          if (component.alto > 0 && component.ancho > 0) {
            foundComponents.push(component);
          }
        }
      } else if (value.toLowerCase().includes("tanque")) {
        // Found Tanque, look for dimensions below
        const match = cellRef.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          const col = match[1];
          const row = parseInt(match[2]);

          const component: ComponentDimensions = {
            name: "Tanque",
            alto: 0,
            ancho: 0,
            diametro: 0,
          };

          for (let i = 1; i <= 10; i++) {
            const labelCell = `${col}${row + i}`;
            const valueCell =
              String.fromCharCode(col.charCodeAt(0) + 1) + (row + i);
            const label = getCellString(labelCell).toLowerCase();

            if (label.includes("alto")) {
              component.alto = getCellValue(valueCell);
            } else if (label.includes("ancho")) {
              component.ancho = getCellValue(valueCell);
            } else if (
              label.includes("diámetro") ||
              label.includes("diametro")
            ) {
              component.diametro = getCellValue(valueCell);
            }
          }

          if (component.alto > 0 && component.ancho > 0) {
            foundComponents.push(component);
          }
        }
      }
    });

    setComponents(foundComponents);
  }, [cells]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Apply transformations
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    const padding = 100;
    const originX = padding;
    const originY = canvas.height / scale - padding;

    // Draw grid
    drawGrid(
      ctx,
      originX,
      originY,
      canvas.width / scale,
      canvas.height / scale,
    );

    // Draw axes
    drawAxes(
      ctx,
      originX,
      originY,
      canvas.width / scale,
      canvas.height / scale,
    );

    // Draw components
    let xOffset = 50;
    components.forEach((component) => {
      drawComponent(ctx, component, originX + xOffset, originY);
      xOffset += component.ancho + 100; // Space between components
    });

    ctx.restore();
  }, [components, scale, offset, isVisible]);

  const drawComponent = (
    ctx: CanvasRenderingContext2D,
    component: ComponentDimensions,
    baseX: number,
    baseY: number,
  ) => {
    const width = component.ancho;
    const height = component.alto;
    const radius = width / 2;

    // Draw position (bottom-left corner)
    const x = baseX;
    const y = baseY - height;

    // Set colors based on component type
    let fillColor = "#D3D3D3"; // Light gray
    let strokeColor = "#333333";

    if (component.name === "Núcleo") {
      fillColor = "#CCCCCC";
    } else if (component.name === "Bobina") {
      fillColor = "#B8860B"; // Golden for inner coil
    } else if (component.name === "Tanque") {
      fillColor = "#DDDDDD";
    }

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;

    // Draw rectangle body
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);

    // Draw semicircular top
    ctx.beginPath();
    ctx.arc(x + radius, y, radius, Math.PI, 0);
    ctx.fill();
    ctx.stroke();

    // Draw inner rectangle for Bobina (showing the coil depth)
    if (component.name === "Bobina" && component.profundidad) {
      const innerMargin = 20;
      const innerWidth = width - innerMargin * 2;
      const innerHeight = component.profundidad;
      const innerY = y + (height - innerHeight) / 2;

      ctx.fillStyle = "#8B6914"; // Darker golden
      ctx.fillRect(x + innerMargin, innerY, innerWidth, innerHeight);
      ctx.strokeRect(x + innerMargin, innerY, innerWidth, innerHeight);
    }

    // Draw dimensions
    ctx.fillStyle = "#000000";
    ctx.strokeStyle = "#000000";
    ctx.font = "14px Arial";
    ctx.lineWidth = 1;

    // Width dimension (bottom)
    const dimLineY = baseY + 30;
    ctx.beginPath();
    ctx.moveTo(x, dimLineY);
    ctx.lineTo(x + width, dimLineY);
    ctx.stroke();
    // Arrows
    ctx.beginPath();
    ctx.moveTo(x, dimLineY);
    ctx.lineTo(x + 5, dimLineY - 3);
    ctx.lineTo(x + 5, dimLineY + 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + width, dimLineY);
    ctx.lineTo(x + width - 5, dimLineY - 3);
    ctx.lineTo(x + width - 5, dimLineY + 3);
    ctx.fill();
    // Text
    ctx.fillText(width.toFixed(2), x + width / 2 - 20, dimLineY + 20);

    // Height dimension (right side)
    const dimLineX = x + width + 30;
    ctx.beginPath();
    ctx.moveTo(dimLineX, y);
    ctx.lineTo(dimLineX, baseY);
    ctx.stroke();
    // Arrows
    ctx.beginPath();
    ctx.moveTo(dimLineX, y);
    ctx.lineTo(dimLineX - 3, y + 5);
    ctx.lineTo(dimLineX + 3, y + 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(dimLineX, baseY);
    ctx.lineTo(dimLineX - 3, baseY - 5);
    ctx.lineTo(dimLineX + 3, baseY - 5);
    ctx.fill();
    // Text
    ctx.save();
    ctx.translate(dimLineX + 20, y + height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(height.toFixed(2), -20, 0);
    ctx.restore();

    // Draw diagonal dimension for Núcleo
    if (component.name === "Núcleo" && component.diagonal) {
      ctx.save();
      const diagX = x + width / 2;
      const diagY = y + height / 2;
      ctx.translate(diagX, diagY);
      ctx.rotate(-Math.PI / 4);
      ctx.strokeStyle = "#9370DB";
      ctx.lineWidth = 1.5;
      const diagLen = component.diagonal;
      ctx.beginPath();
      ctx.moveTo(-diagLen / 2, 0);
      ctx.lineTo(diagLen / 2, 0);
      ctx.stroke();
      ctx.fillStyle = "#9370DB";
      ctx.fillText(`Ø ${component.diagonal.toFixed(2)}`, -30, -10);
      ctx.restore();
    }

    // Draw label inside the shape
    ctx.fillStyle = "#000000";
    ctx.font = "bold 16px Arial";
    ctx.fillText(component.name, x + width / 2 - 30, y + height - 20);
  };

  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    width: number,
    height: number,
  ) => {
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 0.5;

    const gridSize = 50;

    // Vertical lines
    for (let x = originX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = originY; y > 0; y -= gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  const drawAxes = (
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    width: number,
    height: number,
  ) => {
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.font = "12px Arial";
    ctx.fillStyle = "#333";

    // X-axis
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(width - 20, originY);
    ctx.stroke();

    // Arrow for X-axis
    ctx.beginPath();
    ctx.moveTo(width - 20, originY);
    ctx.lineTo(width - 30, originY - 5);
    ctx.lineTo(width - 30, originY + 5);
    ctx.closePath();
    ctx.fill();

    // X-axis label
    ctx.fillText("X", width - 15, originY + 20);

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX, 20);
    ctx.stroke();

    // Arrow for Y-axis
    ctx.beginPath();
    ctx.moveTo(originX, 20);
    ctx.lineTo(originX - 5, 30);
    ctx.lineTo(originX + 5, 30);
    ctx.closePath();
    ctx.fill();

    // Y-axis label
    ctx.fillText("Y", originX - 20, 15);

    // Draw scale markers
    const markerSpacing = 100;
    ctx.font = "10px Arial";
    ctx.lineWidth = 1;

    // X-axis markers
    for (let x = originX + markerSpacing; x < width - 50; x += markerSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, originY - 5);
      ctx.lineTo(x, originY + 5);
      ctx.stroke();
      ctx.fillText(`${Math.round(x - originX)}`, x - 10, originY + 20);
    }

    // Y-axis markers
    for (let y = originY - markerSpacing; y > 30; y -= markerSpacing) {
      ctx.beginPath();
      ctx.moveTo(originX - 5, y);
      ctx.lineTo(originX + 5, y);
      ctx.stroke();
      ctx.fillText(`${Math.round(originY - y)}`, originX - 35, y + 5);
    }
  };

  // Handle mouse events for panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prevScale) => Math.max(0.1, Math.min(5, prevScale * delta)));
  };

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white border-t border-gray-300 h-[600px] relative flex flex-col">
      {/* Controls */}
      <div className="flex items-center gap-4 p-3 border-b border-gray-300 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Zoom:</span>
          <button
            className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
            onClick={() => setScale((s) => Math.max(0.1, s * 0.9))}
          >
            −
          </button>
          <span className="text-sm text-gray-600 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
            onClick={() => setScale((s) => Math.min(5, s * 1.1))}
          >
            +
          </button>
        </div>
        <button
          className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
          onClick={resetView}
        >
          Reset View
        </button>
        <div className="flex-1"></div>
        <div className="text-sm text-gray-600">
          {components.length} component{components.length !== 1 ? "s" : ""}{" "}
          detected |{components.map((c) => c.name).join(", ")} | Drag to pan |
          Scroll to zoom
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
};

export default GraphicsBoard;
