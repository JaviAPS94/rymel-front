import React, { useEffect, useRef } from "react";
import { CellGrid } from "./spreadsheet-types";

interface InlineCellGraphicProps {
  view: "FRONTAL" | "SUPERIOR" | "BOBINADO";
  components: Array<"NUCLEO" | "BOBINA" | "TANQUE">;
  cells: CellGrid;
  dimensionCells?: {
    nucleo?: { alto?: string; ancho?: string };
    bobina?: { profundidad?: string };
    tanque?: { alto?: string; diametro?: string };
  };
  bobinadoCells?: {
    diameter?: string;
    superiorWidths?: string[];
    inferiorWidths?: string[];
    superiorOutputs?: string[];
    inferiorOutputs?: string[];
    outerDiameter?: string;
    rectWidth?: string;
    rectEspesor?: string;
    rectGap?: string;
  };
  onCellValueChange?: (cellRef: string, value: string) => void;
  width: number;
  height: number;
}

// Default dimensions if cells not provided
const DEFAULT_DIMENSIONS = {
  NUCLEO: { alto: 340, ancho: 339.08 },
  BOBINA: { profundidad: 315.85 },
  TANQUE: { alto: 740, diametro: 433.52 },
};

const InlineCellGraphic: React.FC<InlineCellGraphicProps> = ({
  view,
  components,
  cells,
  dimensionCells = {},
  bobinadoCells,
  onCellValueChange,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Track last written expansion values to avoid infinite update loops
  const lastWrittenRef = useRef<string>("");

  // Helper to get cell value
  const getCellValue = (cellRef?: string, defaultVal?: number): number => {
    if (!cellRef) return defaultVal || 0;
    const cell = cells[cellRef.toUpperCase()];
    const value = cell?.computed || cell?.value || defaultVal || 0;
    const numValue =
      typeof value === "string"
        ? parseFloat(value.replace(",", "."))
        : parseFloat(String(value));
    return isNaN(numValue) ? defaultVal || 0 : numValue;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get dimensions for each component
    const hasNucleo = components.includes("NUCLEO");
    const hasBobina = components.includes("BOBINA");
    const hasTanque = components.includes("TANQUE");

    const nucleoAlto = getCellValue(
      dimensionCells.nucleo?.alto,
      DEFAULT_DIMENSIONS.NUCLEO.alto,
    );
    const nucleoAncho = getCellValue(
      dimensionCells.nucleo?.ancho,
      DEFAULT_DIMENSIONS.NUCLEO.ancho,
    );
    const bobinaProfundidad = getCellValue(
      dimensionCells.bobina?.profundidad,
      DEFAULT_DIMENSIONS.BOBINA.profundidad,
    );
    const tanqueAlto = getCellValue(
      dimensionCells.tanque?.alto,
      DEFAULT_DIMENSIONS.TANQUE.alto,
    );
    const tanqueDiametro = getCellValue(
      dimensionCells.tanque?.diametro,
      DEFAULT_DIMENSIONS.TANQUE.diametro,
    );

    // Calculate scale to fit in canvas with optimized padding
    // Left/Right: space for axis labels and dimension arrows
    // Top/Bottom: space for axis labels
    const paddingLeft = 45; // Y-axis labels and "mm" text
    const paddingRight = 50; // Dimension arrows
    const paddingTop = 5; // Minimal top space (reduced to minimize waste)
    const paddingBottom = 45; // X-axis labels and "mm" text (increased for visibility)

    const availableWidth = width - paddingLeft - paddingRight;
    const availableHeight = height - paddingTop - paddingBottom;

    // Check if canvas is too small
    if (
      availableWidth <= 0 ||
      availableHeight <= 0 ||
      width < 100 ||
      height < 100
    ) {
      ctx.fillStyle = "#666";
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Cell too small - merge more cells", width / 2, height / 2);
      return;
    }

    // Draw based on view and components
    if (view === "BOBINADO") {
      const diameter = getCellValue(bobinadoCells?.diameter, 600);
      const superiorWidths = (bobinadoCells?.superiorWidths || []).map((ref) =>
        getCellValue(ref, 0),
      );
      const inferiorWidths = (bobinadoCells?.inferiorWidths || []).map((ref) =>
        getCellValue(ref, 0),
      );
      const outerDiameter = getCellValue(bobinadoCells?.outerDiameter, 0);
      const rectWidth = getCellValue(bobinadoCells?.rectWidth, 0);
      const rectEspesor = getCellValue(bobinadoCells?.rectEspesor, 0);
      const rectGap = getCellValue(bobinadoCells?.rectGap, 0);

      // Calculate the bottom of rect2 — this is the upper cut boundary for superior staircase
      let yBottomRect2Mm = Infinity;
      if (outerDiameter > diameter && rectWidth > 0 && rectEspesor > 0) {
        const halfW = rectWidth / 2;
        const disc = (outerDiameter / 2) * (outerDiameter / 2) - halfW * halfW;
        if (disc >= 0) {
          const yTopCorner = Math.sqrt(disc);
          yBottomRect2Mm = yTopCorner - rectGap - rectEspesor;
        }
      }

      drawBobinado(
        ctx,
        diameter,
        superiorWidths.filter((v) => v > 0),
        inferiorWidths.filter((v) => v > 0),
        availableWidth,
        availableHeight,
        paddingLeft,
        paddingTop,
        outerDiameter > diameter ? outerDiameter : 0,
        rectWidth,
        rectEspesor,
        rectGap,
        yBottomRect2Mm,
      );

      // Write computed expansion values to output cells
      if (onCellValueChange) {
        const supPlacements = computeStaircasePlacements(
          superiorWidths,
          diameter,
          yBottomRect2Mm,
        );
        const infPlacements = computeStaircasePlacements(
          inferiorWidths,
          diameter,
          Infinity,
        );
        const supExpansions = supPlacements.map((p) => (p ? p.exp : 0));
        const infExpansions = infPlacements.map((p) => (p ? p.exp : 0));
        const supOutputs = bobinadoCells?.superiorOutputs || [];
        const infOutputs = bobinadoCells?.inferiorOutputs || [];

        const newValues: Record<string, string> = {};
        supExpansions.forEach((exp, i) => {
          if (supOutputs[i]) {
            newValues[supOutputs[i].toUpperCase()] = exp > 0 ? exp.toFixed(1) : "";
          }
        });
        infExpansions.forEach((exp, i) => {
          if (infOutputs[i]) {
            newValues[infOutputs[i].toUpperCase()] = exp > 0 ? exp.toFixed(1) : "";
          }
        });

        const newValuesStr = JSON.stringify(newValues);
        if (newValuesStr !== lastWrittenRef.current && Object.keys(newValues).length > 0) {
          lastWrittenRef.current = newValuesStr;
          Object.entries(newValues).forEach(([ref, val]) => {
            onCellValueChange(ref, val);
          });
        }
      }
    } else if (view === "FRONTAL") {
      if (hasNucleo && !hasBobina && !hasTanque) {
        // Image 1: FRONTAL NUCLEO only
        drawFrontalNucleo(
          ctx,
          nucleoAlto,
          nucleoAncho,
          availableWidth,
          availableHeight,
          width,
          height,
          paddingLeft,
          paddingTop,
        );
      } else if (hasTanque && hasNucleo && hasBobina) {
        // Image 3: FRONTAL TANQUE+NUCLEO+BOBINA
        drawFrontalAll(
          ctx,
          tanqueAlto,
          tanqueDiametro,
          nucleoAlto,
          nucleoAncho,
          availableWidth,
          availableHeight,
          width,
          height,
          paddingLeft,
          paddingTop,
        );
      }
    } else if (view === "SUPERIOR") {
      if (hasNucleo && hasBobina && !hasTanque) {
        // Image 2: SUPERIOR NUCLEO+BOBINA
        drawSuperiorNucleoBobina(
          ctx,
          nucleoAncho,
          bobinaProfundidad,
          availableWidth,
          availableHeight,
          width,
          height,
          paddingLeft,
          paddingTop,
        );
      } else if (hasTanque && hasNucleo && hasBobina) {
        // Image 4: SUPERIOR TANQUE+NUCLEO+BOBINA
        drawSuperiorAll(
          ctx,
          tanqueDiametro,
          nucleoAncho,
          bobinaProfundidad,
          availableWidth,
          availableHeight,
          width,
          height,
          paddingLeft,
          paddingTop,
        );
      }
    }
  }, [view, components, cells, dimensionCells, bobinadoCells, onCellValueChange, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
};

// Helper function to draw coordinate grid with axis measurements
function drawAxisGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  realWidth: number,
  realHeight: number,
  scale: number,
) {
  const gridStep = 50; // Grid line every 50mm
  const scaledStep = gridStep * scale;

  // Calculate label skip interval based on actual pixel spacing
  // Need at least ~35-40 pixels between labels to avoid overlap
  const minLabelSpacing = 35; // minimum pixels between labels
  const xLabelSkip = Math.max(1, Math.ceil(minLabelSpacing / scaledStep));
  const yLabelSkip = Math.max(1, Math.ceil(minLabelSpacing / scaledStep));

  const numXSteps = Math.ceil(realWidth / gridStep);
  const numYSteps = Math.ceil(realHeight / gridStep);

  // Draw grid background
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 0.5;

  // Vertical grid lines with x-axis labels (divided by 100)
  for (let i = 0; i <= numXSteps; i++) {
    const xPos = x + i * scaledStep;
    if (xPos <= x + width) {
      // Draw vertical line
      ctx.beginPath();
      ctx.moveTo(xPos, y);
      ctx.lineTo(xPos, y + height);
      ctx.stroke();

      // Draw x-axis label (only at intervals to prevent overlap)
      if (i % xLabelSkip === 0) {
        ctx.fillStyle = "#6B7280";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        const displayValue = (i * gridStep) / 100;
        ctx.fillText(displayValue.toFixed(1), xPos, y + height + 22);
      }
    }
  }

  // Horizontal grid lines with y-axis labels (inverted - 0 at bottom, divided by 100)
  for (let i = 0; i <= numYSteps; i++) {
    const yPos = y + height - i * scaledStep; // Start from bottom
    if (yPos >= y) {
      // Draw horizontal line
      ctx.beginPath();
      ctx.moveTo(x, yPos);
      ctx.lineTo(x + width, yPos);
      ctx.stroke();

      // Draw y-axis label (only at intervals to prevent overlap)
      if (i % yLabelSkip === 0) {
        ctx.fillStyle = "#6B7280";
        ctx.font = "10px Arial";
        ctx.textAlign = "right";
        const displayValue = (i * gridStep) / 100;
        ctx.fillText(displayValue.toFixed(1), x - 10, yPos + 4);
      }
    }
  }

  // Draw scale indicator in top-left corner
  ctx.fillStyle = "#374151";
  ctx.font = "bold 10px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Scale: 1 = 100mm", x + 5, y + 12);

  // Draw axis labels (removed "mm" since scale indicator explains units)
  ctx.fillStyle = "#374151";
  ctx.font = "bold 11px Arial";

  // X-axis label removed (or could keep as reference)
  // Y-axis label removed (or could keep as reference)
}

// Image 1: FRONTAL view of NUCLEO only
function drawFrontalNucleo(
  ctx: CanvasRenderingContext2D,
  alto: number,
  ancho: number,
  availableWidth: number,
  availableHeight: number,
  width: number,
  height: number,
  paddingLeft: number,
  paddingTop: number,
) {
  const scale = Math.min(availableWidth / ancho, availableHeight / alto);
  const scaledW = ancho * scale;
  const scaledH = alto * scale;
  // Position accounting for asymmetric padding
  const x = paddingLeft + (availableWidth - scaledW) / 2;
  const y = paddingTop + (availableHeight - scaledH) / 2;

  // Draw coordinate grid
  drawAxisGrid(ctx, x, y, scaledW, scaledH, ancho, alto, scale);

  // Draw outer rectangle (white background)
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 3;
  ctx.fillRect(x, y, scaledW, scaledH);
  ctx.strokeRect(x, y, scaledW, scaledH);

  // Draw two inner rectangular frames side by side (no fill, just borders)
  const gapWidth = scaledW * 0.08;
  const innerWidth = (scaledW - gapWidth) / 2 - scaledW * 0.12;
  const innerMargin = scaledW * 0.1;
  const innerHeight = scaledH * 0.7;
  const innerY = y + (scaledH - innerHeight) / 2;

  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 2;

  // Left rectangle (outline only)
  const leftX = x + innerMargin;
  ctx.strokeRect(leftX, innerY, innerWidth, innerHeight);

  // Right rectangle (outline only)
  const rightX = x + innerMargin + innerWidth + gapWidth;
  ctx.strokeRect(rightX, innerY, innerWidth, innerHeight);

  // Draw dimension arrows
  drawDimensionArrows(ctx, x, y, scaledW, scaledH, ancho, alto);
}

// Image 2: SUPERIOR view of NUCLEO + BOBINA
function drawSuperiorNucleoBobina(
  ctx: CanvasRenderingContext2D,
  nucleoAncho: number,
  bobinaProfundidad: number,
  availableWidth: number,
  availableHeight: number,
  width: number,
  height: number,
  paddingLeft: number,
  paddingTop: number,
) {
  const scale = Math.min(
    availableWidth / nucleoAncho,
    availableHeight / bobinaProfundidad,
  );
  const scaledW = nucleoAncho * scale;
  const scaledH = bobinaProfundidad * scale;
  // Position accounting for asymmetric padding
  const x = paddingLeft + (availableWidth - scaledW) / 2;
  const y = paddingTop + (availableHeight - scaledH) / 2;
  const radius = scaledW / 2;

  // Draw coordinate grid
  drawAxisGrid(
    ctx,
    x,
    y,
    scaledW,
    scaledH,
    nucleoAncho,
    bobinaProfundidad,
    scale,
  );

  // Draw BOBINA semicircles at top and bottom first (brown/golden)
  const semiRadius = radius * 0.25;
  if (semiRadius > 0) {
    ctx.fillStyle = "#B8860B";
    ctx.strokeStyle = "#8B6914";
    ctx.lineWidth = 2;

    // Top semicircle
    ctx.beginPath();
    ctx.arc(x + scaledW / 2, y, semiRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bottom semicircle
    ctx.beginPath();
    ctx.arc(x + scaledW / 2, y + scaledH, semiRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Draw NUCLEO rectangle on top (grey)
  ctx.fillStyle = "#CCCCCC";
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 3;
  ctx.fillRect(x, y, scaledW, scaledH);
  ctx.strokeRect(x, y, scaledW, scaledH);

  // Draw vertical dividing line in the middle of NUCLEO
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + scaledW / 2, y);
  ctx.lineTo(x + scaledW / 2, y + scaledH);
  ctx.stroke();

  // Draw height dimension
  const dimX = x + scaledW + 15;
  ctx.strokeStyle = "#6B46C1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(dimX, y);
  ctx.lineTo(dimX, y + scaledH);
  ctx.stroke();

  // Arrows
  ctx.fillStyle = "#6B46C1";
  ctx.beginPath();
  ctx.moveTo(dimX, y);
  ctx.lineTo(dimX - 3, y + 5);
  ctx.lineTo(dimX + 3, y + 5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(dimX, y + scaledH);
  ctx.lineTo(dimX - 3, y + scaledH - 5);
  ctx.lineTo(dimX + 3, y + scaledH - 5);
  ctx.fill();

  // Text (rotated)
  ctx.save();
  ctx.translate(dimX + 25, y + scaledH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#000000";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(bobinaProfundidad.toFixed(2), 0, 0);
  ctx.restore();
}

// Image 3: FRONTAL view of TANQUE + NUCLEO + BOBINA
function drawFrontalAll(
  ctx: CanvasRenderingContext2D,
  tanqueAlto: number,
  tanqueAncho: number,
  nucleoAlto: number,
  nucleoAncho: number,
  availableWidth: number,
  availableHeight: number,
  width: number,
  height: number,
  paddingLeft: number,
  paddingTop: number,
) {
  const scale = Math.min(
    availableWidth / tanqueAncho,
    availableHeight / tanqueAlto,
  );
  const scaledTanqueW = tanqueAncho * scale;
  const scaledTanqueH = tanqueAlto * scale;
  // Position accounting for asymmetric padding
  const x = paddingLeft + (availableWidth - scaledTanqueW) / 2;
  const y = paddingTop + (availableHeight - scaledTanqueH) / 2;

  // Draw coordinate grid
  drawAxisGrid(
    ctx,
    x,
    y,
    scaledTanqueW,
    scaledTanqueH,
    tanqueAncho,
    tanqueAlto,
    scale,
  );

  // Draw TANQUE (outer black rectangle)
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, scaledTanqueW, scaledTanqueH);

  // Calculate NUCLEO dimensions and position (centered inside TANQUE)
  const scaledNucleoW = nucleoAncho * scale;
  const scaledNucleoH = nucleoAlto * scale;
  const nucleoX = x + (scaledTanqueW - scaledNucleoW) / 2;
  const nucleoY = y + (scaledTanqueH - scaledNucleoH) / 2;

  // Calculate BOBINA dimensions (smaller, centered inside NUCLEO)
  const bobinaMargin = scaledNucleoW * 0.2;
  const bobinaW = scaledNucleoW - bobinaMargin * 2;
  const bobinaH = scaledNucleoH * 0.6;
  const bobinaX = nucleoX + bobinaMargin;
  const bobinaY = nucleoY + (scaledNucleoH - bobinaH) / 2;

  // Draw NUCLEO first (white rectangle)
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 3;
  ctx.fillRect(nucleoX, nucleoY, scaledNucleoW, scaledNucleoH);
  ctx.strokeRect(nucleoX, nucleoY, scaledNucleoW, scaledNucleoH);

  // Draw BOBINA on top (brown rectangle) - visible inside NUCLEO
  ctx.fillStyle = "#B8860B";
  ctx.strokeStyle = "#8B6914";
  ctx.lineWidth = 2;
  ctx.fillRect(bobinaX, bobinaY, bobinaW, bobinaH);
  ctx.strokeRect(bobinaX, bobinaY, bobinaW, bobinaH);

  // Draw dimension arrows for height
  const dimX = x + scaledTanqueW + 15;
  ctx.strokeStyle = "#6B46C1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(dimX, y);
  ctx.lineTo(dimX, y + scaledTanqueH);
  ctx.stroke();

  // Arrows
  ctx.fillStyle = "#6B46C1";
  ctx.beginPath();
  ctx.moveTo(dimX, y);
  ctx.lineTo(dimX - 3, y + 5);
  ctx.lineTo(dimX + 3, y + 5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(dimX, y + scaledTanqueH);
  ctx.lineTo(dimX - 3, y + scaledTanqueH - 5);
  ctx.lineTo(dimX + 3, y + scaledTanqueH - 5);
  ctx.fill();

  // Text (rotated)
  ctx.save();
  ctx.translate(dimX + 25, y + scaledTanqueH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#000000";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(tanqueAlto.toFixed(2), 0, 0);
  ctx.restore();

  // Draw dimension arrows for width
  const dimY = y + scaledTanqueH + 20;
  ctx.strokeStyle = "#6B46C1";
  ctx.beginPath();
  ctx.moveTo(x, dimY);
  ctx.lineTo(x + scaledTanqueW, dimY);
  ctx.stroke();

  // Arrows
  ctx.fillStyle = "#6B46C1";
  ctx.beginPath();
  ctx.moveTo(x, dimY);
  ctx.lineTo(x + 5, dimY - 3);
  ctx.lineTo(x + 5, dimY + 3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + scaledTanqueW, dimY);
  ctx.lineTo(x + scaledTanqueW - 5, dimY - 3);
  ctx.lineTo(x + scaledTanqueW - 5, dimY + 3);
  ctx.fill();

  // Text
  ctx.fillStyle = "#000000";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(tanqueAncho.toFixed(2), x + scaledTanqueW / 2, dimY + 20);
}

// Image 4: SUPERIOR view of TANQUE + NUCLEO + BOBINA
function drawSuperiorAll(
  ctx: CanvasRenderingContext2D,
  tanqueDiametro: number,
  nucleoAncho: number,
  bobinaProfundidad: number,
  availableWidth: number,
  availableHeight: number,
  width: number,
  height: number,
  paddingLeft: number,
  paddingTop: number,
) {
  const scale = Math.min(
    availableWidth / tanqueDiametro,
    availableHeight / tanqueDiametro,
  );
  const scaledDiameter = tanqueDiametro * scale;
  const radius = scaledDiameter / 2;
  // Position accounting for asymmetric padding
  const centerX = paddingLeft + availableWidth / 2;
  const centerY = paddingTop + availableHeight / 2;

  // Draw coordinate grid (for circular view, use diameter for both dimensions)
  const gridX = centerX - radius;
  const gridY = centerY - radius;
  drawAxisGrid(
    ctx,
    gridX,
    gridY,
    scaledDiameter,
    scaledDiameter,
    tanqueDiametro,
    tanqueDiametro,
    scale,
  );

  // Draw TANQUE circle (black outline)
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw NUCLEO rectangle (grey, centered inside circle)
  // Ensure rectangle fits inside circle with margin
  let nucleoW = nucleoAncho;
  let nucleoH = bobinaProfundidad;

  // Calculate diagonal and check if it fits in circle
  const rectDiagonal = Math.sqrt(nucleoW * nucleoW + nucleoH * nucleoH);
  const maxDiagonal = tanqueDiametro * 0.85; // 85% of diameter to have margin

  if (rectDiagonal > maxDiagonal) {
    // Scale down rectangle to fit inside circle
    const scaleFactor = maxDiagonal / rectDiagonal;
    nucleoW = nucleoW * scaleFactor;
    nucleoH = nucleoH * scaleFactor;
  }

  const scaledNucleoW = nucleoW * scale;
  const scaledNucleoH = nucleoH * scale;
  const nucleoX = centerX - scaledNucleoW / 2;
  const nucleoY = centerY - scaledNucleoH / 2;

  // Draw BOBINA semicircles first at top and bottom (brown)
  const semiRadius = (scaledNucleoW / 2) * 0.3;
  if (semiRadius > 0) {
    ctx.fillStyle = "#B8860B";
    ctx.strokeStyle = "#8B6914";
    ctx.lineWidth = 2;

    // Top semicircle
    ctx.beginPath();
    ctx.arc(centerX, nucleoY, semiRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bottom semicircle
    ctx.beginPath();
    ctx.arc(centerX, nucleoY + scaledNucleoH, semiRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Draw NUCLEO rectangle on top (grey)
  ctx.fillStyle = "#CCCCCC";
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 3;
  ctx.fillRect(nucleoX, nucleoY, scaledNucleoW, scaledNucleoH);
  ctx.strokeRect(nucleoX, nucleoY, scaledNucleoW, scaledNucleoH);

  // Draw vertical dividing line in the middle of NUCLEO
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, nucleoY);
  ctx.lineTo(centerX, nucleoY + scaledNucleoH);
  ctx.stroke();

  // Draw diagonal dimension line for TANQUE diameter
  const angle = Math.PI / 4;
  const startX = centerX - radius * 0.8 * Math.cos(angle);
  const startY = centerY - radius * 0.8 * Math.sin(angle);
  const endX = centerX + radius * 0.8 * Math.cos(angle);
  const endY = centerY + radius * 0.8 * Math.sin(angle);

  ctx.strokeStyle = "#6B46C1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Arrows
  ctx.fillStyle = "#6B46C1";
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(
    startX + 5 * Math.cos(angle + Math.PI / 2),
    startY + 5 * Math.sin(angle + Math.PI / 2),
  );
  ctx.lineTo(
    startX + 5 * Math.cos(angle - Math.PI / 2),
    startY + 5 * Math.sin(angle - Math.PI / 2),
  );
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - 5 * Math.cos(angle + Math.PI / 2),
    endY - 5 * Math.sin(angle + Math.PI / 2),
  );
  ctx.lineTo(
    endX - 5 * Math.cos(angle - Math.PI / 2),
    endY - 5 * Math.sin(angle - Math.PI / 2),
  );
  ctx.fill();

  // Draw diameter dimension below
  const dimY = centerY + radius + 25;
  const dimStartX = centerX - radius * 0.8;
  const dimEndX = centerX + radius * 0.8;

  ctx.strokeStyle = "#6B46C1";
  ctx.beginPath();
  ctx.moveTo(dimStartX, dimY);
  ctx.lineTo(dimEndX, dimY);
  ctx.stroke();

  // Arrows
  ctx.fillStyle = "#6B46C1";
  ctx.beginPath();
  ctx.moveTo(dimStartX, dimY);
  ctx.lineTo(dimStartX + 5, dimY - 3);
  ctx.lineTo(dimStartX + 5, dimY + 3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(dimEndX, dimY);
  ctx.lineTo(dimEndX - 5, dimY - 3);
  ctx.lineTo(dimEndX - 5, dimY + 3);
  ctx.fill();

  // Text
  ctx.fillStyle = "#000000";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(tanqueDiametro.toFixed(2), centerX, dimY + 20);
}

// Helper function to draw dimension arrows
function drawDimensionArrows(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  widthValue: number,
  heightValue: number,
) {
  ctx.strokeStyle = "#6B46C1";
  ctx.lineWidth = 1.5;

  // Width dimension (bottom)
  const dimY = y + h + 20;
  ctx.beginPath();
  ctx.moveTo(x, dimY);
  ctx.lineTo(x + w, dimY);
  ctx.stroke();

  // Arrows
  ctx.fillStyle = "#6B46C1";
  ctx.beginPath();
  ctx.moveTo(x, dimY);
  ctx.lineTo(x + 5, dimY - 3);
  ctx.lineTo(x + 5, dimY + 3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w, dimY);
  ctx.lineTo(x + w - 5, dimY - 3);
  ctx.lineTo(x + w - 5, dimY + 3);
  ctx.fill();

  // Text
  ctx.fillStyle = "#000000";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(widthValue.toFixed(2), x + w / 2, dimY + 20);

  // Height dimension (left side)
  const dimX = x - 20;
  ctx.strokeStyle = "#6B46C1";
  ctx.beginPath();
  ctx.moveTo(dimX, y);
  ctx.lineTo(dimX, y + h);
  ctx.stroke();

  // Arrows
  ctx.fillStyle = "#6B46C1";
  ctx.beginPath();
  ctx.moveTo(dimX, y);
  ctx.lineTo(dimX - 3, y + 5);
  ctx.lineTo(dimX + 3, y + 5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(dimX, y + h);
  ctx.lineTo(dimX - 3, y + h - 5);
  ctx.lineTo(dimX + 3, y + h - 5);
  ctx.fill();

  // Text (rotated)
  ctx.save();
  ctx.translate(dimX - 15, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#000000";
  ctx.fillText(heightValue.toFixed(2), 0, 0);
  ctx.restore();
}

// Compute staircase placements for a list of widths against an inner circle.
// When `yMax` caps the staircase (superior side under the gray-rect cut line),
// the largest unplaced width whose natural touch point is above the cut is
// fitted into the residual space [yRef, yMax] with its top capped at yMax.
type StaircasePlacement = {
  exp: number;
  yBottomMm: number;
  yTopMm: number;
  widthMm: number;
};

function computeStaircasePlacements(
  widths: number[],
  innerDiameter: number,
  yMax: number,
): Array<StaircasePlacement | null> {
  const R = innerDiameter / 2;
  const placements: Array<StaircasePlacement | null> = widths.map(() => null);
  if (innerDiameter <= 0) return placements;

  let yRef = 0;
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    if (w <= 0 || w > innerDiameter) continue;
    const disc = R * R - (w / 2) * (w / 2);
    if (disc < 0) continue;
    const yTouch = Math.sqrt(disc);
    if (yTouch <= yRef) continue;
    if (yTouch > yMax) continue;
    placements[i] = {
      exp: yTouch - yRef,
      yBottomMm: yRef,
      yTopMm: yTouch,
      widthMm: w,
    };
    yRef = yTouch;
  }

  // Fit the largest unplaced width that was skipped due to the cut into the
  // residual space, capping its top at yMax.
  if (yMax < Infinity && yRef < yMax) {
    let bestIdx = -1;
    let bestW = -1;
    for (let i = 0; i < widths.length; i++) {
      if (placements[i]) continue;
      const w = widths[i];
      if (w <= 0 || w > innerDiameter) continue;
      const disc = R * R - (w / 2) * (w / 2);
      if (disc < 0) continue;
      const yTouch = Math.sqrt(disc);
      if (yTouch <= yMax) continue; // skipped for a reason other than the cut
      if (w > bestW) {
        bestW = w;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      placements[bestIdx] = {
        exp: yMax - yRef,
        yBottomMm: yRef,
        yTopMm: yMax,
        widthMm: bestW,
      };
    }
  }

  return placements;
}

// BOBINADO: circle with staircase rectangles from two winding tables (Superior + Inferior)
// Optional outer circle with two gray rectangles at the top.
function drawBobinado(
  ctx: CanvasRenderingContext2D,
  innerDiameter: number,
  superiorWidths: number[],
  inferiorWidths: number[],
  availableWidth: number,
  availableHeight: number,
  paddingLeft: number,
  paddingTop: number,
  outerDiameter: number = 0,
  rectWidth: number = 0,
  rectEspesor: number = 0,
  rectGap: number = 0,
  yBottomRect2Mm: number = Infinity, // upper cut boundary for superior staircase
) {
  if (innerDiameter <= 0) return;

  const R_inner = innerDiameter / 2;
  const hasOuter = outerDiameter > innerDiameter;
  const R_outer = hasOuter ? outerDiameter / 2 : R_inner;

  const maxDiam = hasOuter ? outerDiameter : innerDiameter;
  const scale = Math.min(availableWidth / maxDiam, availableHeight / maxDiam);
  const scaledRInner = R_inner * scale;
  const scaledROuter = R_outer * scale;
  const centerX = paddingLeft + availableWidth / 2;
  const centerY = paddingTop + availableHeight / 2;

  // Background grid
  drawAxisGrid(
    ctx,
    centerX - scaledROuter,
    centerY - scaledROuter,
    scaledROuter * 2,
    scaledROuter * 2,
    maxDiam,
    maxDiam,
    scale,
  );

  // --- Staircase layers (reference INNER circle; superior limited to yBottomRect2Mm) ---
  const drawLayers = (widths: number[], isInferior: boolean) => {
    const yMax = isInferior ? Infinity : yBottomRect2Mm;
    const placements = computeStaircasePlacements(widths, innerDiameter, yMax);
    for (const p of placements) {
      if (!p) continue;
      const halfW = p.widthMm / 2;
      const rx = centerX - halfW * scale;
      const rw = p.widthMm * scale;
      const rh = p.exp * scale;
      const ry = isInferior
        ? centerY + p.yBottomMm * scale
        : centerY - p.yTopMm * scale;
      ctx.strokeStyle = "#1e3a8a";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx, ry, rw, rh);
      if (rh > 8) {
        ctx.fillStyle = "#374151";
        ctx.font = "9px Arial";
        ctx.textAlign = "left";
        ctx.fillText(p.exp.toFixed(1), centerX + halfW * scale + 4, ry + rh / 2 + 3);
      }
    }
  };

  drawLayers(superiorWidths, false);
  drawLayers(inferiorWidths, true);

  // --- Inner circle: full circle OR lower arc only when cut boundary is active ---
  ctx.strokeStyle = "#B8860B";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (yBottomRect2Mm < Infinity && yBottomRect2Mm > 0 && yBottomRect2Mm < R_inner) {
    // Draw only the arc below the cut line.
    // In canvas coords (y down), a point at height yBottomRect2Mm above center satisfies:
    //   sin(θ) = -yBottomRect2Mm / R_inner
    // θ1 = asin(sinCut) → upper-right intersection (negative angle)
    // θ2 = π - θ1        → upper-left  intersection (> π)
    // Clockwise arc from θ1 → θ2 traces right→bottom→left (the lower portion).
    const sinCut = -yBottomRect2Mm / R_inner;
    const theta1 = Math.asin(sinCut);   // upper-right, in (-π/2, 0)
    const theta2 = Math.PI - theta1;    // upper-left,  in (π, 3π/2)
    ctx.arc(centerX, centerY, scaledRInner, theta1, theta2, false); // clockwise
  } else {
    ctx.arc(centerX, centerY, scaledRInner, 0, Math.PI * 2);
  }
  ctx.stroke();

  // --- Horizontal cut line connecting the two arc endpoints ---
  if (yBottomRect2Mm < Infinity && yBottomRect2Mm > 0 && yBottomRect2Mm < R_inner) {
    const xCutHalf = Math.sqrt(R_inner * R_inner - yBottomRect2Mm * yBottomRect2Mm);
    const cutY = centerY - yBottomRect2Mm * scale;
    ctx.strokeStyle = "#B8860B";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - xCutHalf * scale, cutY);
    ctx.lineTo(centerX + xCutHalf * scale, cutY);
    ctx.stroke();
  }

  // --- Outer circle + gray rectangles (optional) ---
  if (hasOuter) {
    // Outer circle (lighter golden)
    ctx.strokeStyle = "#DAA520";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, scaledROuter, 0, Math.PI * 2);
    ctx.stroke();

    // Two gray rectangles at the top if dimensions are provided
    if (rectWidth > 0 && rectEspesor > 0) {
      const halfW = rectWidth / 2;
      const disc = R_outer * R_outer - halfW * halfW;
      if (disc >= 0) {
        const yTopCorner = Math.sqrt(disc); // y (mm) where top corners touch outer circle
        const rx = centerX - halfW * scale;
        const rw = rectWidth * scale;
        const rh = rectEspesor * scale;

        // Rect 1: top corners at outer circle boundary
        const ry1 = centerY - yTopCorner * scale;
        ctx.fillStyle = "rgba(150, 150, 150, 0.75)";
        ctx.strokeStyle = "#555555";
        ctx.lineWidth = 1.5;
        ctx.fillRect(rx, ry1, rw, rh);
        ctx.strokeRect(rx, ry1, rw, rh);

        // Rect 2: gap measured downward from the top-corner of rect 1
        const yTopRect2 = yTopCorner - rectGap;
        if (yTopRect2 > 0) {
          const ry2 = centerY - yTopRect2 * scale;
          ctx.fillStyle = "rgba(150, 150, 150, 0.75)";
          ctx.strokeStyle = "#555555";
          ctx.lineWidth = 1.5;
          ctx.fillRect(rx, ry2, rw, rh);
          ctx.strokeRect(rx, ry2, rw, rh);
        }
      }
    }
  }

  // --- Center cross-hair ---
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(centerX - scaledROuter, centerY);
  ctx.lineTo(centerX + scaledROuter, centerY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - scaledROuter);
  ctx.lineTo(centerX, centerY + scaledROuter);
  ctx.stroke();
  ctx.setLineDash([]);

  // --- Diameter annotation (shows the outer diameter if present, else inner) ---
  const annotR = hasOuter ? scaledROuter : scaledRInner;
  const annotDiam = hasOuter ? outerDiameter : innerDiameter;
  const dimY = centerY + annotR + 20;
  ctx.strokeStyle = "#6B46C1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX - annotR * 0.8, dimY);
  ctx.lineTo(centerX + annotR * 0.8, dimY);
  ctx.stroke();
  ctx.fillStyle = "#6B46C1";
  ctx.beginPath();
  ctx.moveTo(centerX - annotR * 0.8, dimY);
  ctx.lineTo(centerX - annotR * 0.8 + 5, dimY - 3);
  ctx.lineTo(centerX - annotR * 0.8 + 5, dimY + 3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(centerX + annotR * 0.8, dimY);
  ctx.lineTo(centerX + annotR * 0.8 - 5, dimY - 3);
  ctx.lineTo(centerX + annotR * 0.8 - 5, dimY + 3);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`Ø ${annotDiam.toFixed(1)} mm`, centerX, dimY + 16);
}

export default InlineCellGraphic;
