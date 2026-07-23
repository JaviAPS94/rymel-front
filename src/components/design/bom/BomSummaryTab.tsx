import { useState } from "react";
import { ClipboardList, Loader2, RefreshCw } from "lucide-react";
import { BomResponse, DesignSubtype, ElementResponse, Template } from "../../../commons/types";
import { useLazyGetBomByCodeQuery } from "../../../store";
import { Cell, Sheet } from "../spreadsheet-types";
import Button from "../../core/Button";
import { Modal } from "../../core/Modal";
import SpreadSheet from "../SpreadSheet";
import { BOM_SUMMARY_COLUMN_WIDTHS, buildBomSummaryCells } from "./buildBomSummary";

interface BomSummaryTabProps {
  element: ElementResponse;
  sheets: Sheet[]; // design sheets, used to resolve item catalogs / semi-finished zones
  subTypeWithFunctions: DesignSubtype;
}

// No design templates apply to the generated BOM workbook.
const NO_TEMPLATES: Template[] = [];

const buildBomSheet = (
  bom: BomResponse,
  expandedChildNodes: Set<number>,
  sheets: Sheet[],
  element: ElementResponse,
): Sheet => ({
  id: `bom-sheet-${Date.now()}`,
  name: "Lista de Materiales",
  cells: buildBomSummaryCells(bom, expandedChildNodes, sheets, element),
  columnWidths: BOM_SUMMARY_COLUMN_WIDTHS,
  rowHeights: {},
  templateHiddenRows: new Set<number>(),
  templateHiddenColumns: new Set<number>(),
  userHiddenRows: new Set<number>(),
  userHiddenColumns: new Set<number>(),
  hiddenCells: new Set<string>(),
  freezeRow: 0,
  freezeColumn: 0,
  mergedCells: [],
});

const BomSummaryTab = ({ element, sheets, subTypeWithFunctions }: BomSummaryTabProps) => {
  const [triggerGetBom, { isFetching }] = useLazyGetBomByCodeQuery();
  const [bomData, setBomData] = useState<BomResponse | null>(null);
  const [expandedChildNodes, setExpandedChildNodes] = useState<Set<number>>(
    new Set(),
  );
  const [bomSheets, setBomSheets] = useState<Sheet[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  const handleGenerate = async () => {
    if (!element.sapReference) {
      console.error("[BOM] element.sapReference is not set", element);
      setErrorMessage(
        "Este elemento no tiene referencia SAP configurada. No se puede generar la lista de materiales.",
      );
      return;
    }

    let result: Awaited<ReturnType<typeof triggerGetBom>>;
    try {
      result = await triggerGetBom(element.sapReference);
    } catch (err) {
      console.error("[BOM] triggerGetBom threw:", err);
      setErrorMessage(
        "Error al consultar la estructura BOM. Revisa la consola para más detalles.",
      );
      return;
    }

    if (!result.data) {
      console.error("[BOM] No data returned. error:", result.error, "sapReference:", element.sapReference);
      setErrorMessage(
        `No se encontró estructura BOM para la referencia SAP: ${element.sapReference}`,
      );
      return;
    }

    const freshExpanded = new Set<number>();
    setBomData(result.data);
    setExpandedChildNodes(freshExpanded);
    setBomSheets([buildBomSheet(result.data, freshExpanded, sheets, element)]);
  };

  // Clicking the ▶/▼ cell in column A of a child SF row expands/collapses
  // that node's items inline, without touching the rest of the sheet (same
  // sheet id, so the SpreadSheet instance doesn't remount).
  const handleBomCellClick = (_cellRef: string, cell: Cell | undefined) => {
    if (!bomData || cell?.bomToggleNodeId === undefined) return false;
    const nodeId = cell.bomToggleNodeId;
    const next = new Set(expandedChildNodes);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    setExpandedChildNodes(next);
    const freshCells = buildBomSummaryCells(bomData, next, sheets, element);
    setBomSheets((prev) =>
      prev.map((s, i) => (i === 0 ? { ...s, cells: freshCells } : s)),
    );
    return true;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white rounded-2xl shadow-md border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              Lista de materiales (BOM)
            </h3>
            <p className="text-xs text-slate-400">
              {bomSheets.length > 0
                ? "Generada a partir de la referencia SAP del elemento. Puedes editarla como cualquier otra hoja."
                : "Construye el desglose de materiales de este diseño a partir de su referencia SAP."}
            </p>
          </div>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isFetching}
          className="rounded-xl h-[2.8rem] bg-violet-600 border-violet-600 hover:bg-violet-700 hover:border-violet-700 text-white"
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isFetching
            ? "Generando..."
            : bomSheets.length > 0
              ? "Actualizar Lista de Materiales"
              : "Generar Lista de Materiales"}
        </Button>
      </div>

      {bomSheets.length > 0 && (
        <SpreadSheet
          key={bomSheets[0].id}
          instanceId="bom"
          subTypeWithFunctions={subTypeWithFunctions}
          templates={NO_TEMPLATES}
          element={element}
          designSubtypeId={null}
          setShowModalAfterSaveDesign={() => {}}
          showTemplateLibrary={showTemplateLibrary}
          setShowTemplateLibrary={setShowTemplateLibrary}
          sheets={bomSheets}
          setSheets={setBomSheets}
          sheetsInitialData={bomSheets}
          onCellClick={handleBomCellClick}
        />
      )}

      <Modal
        isOpen={errorMessage !== null}
        onClose={() => setErrorMessage(null)}
        title="No se pudo generar la lista de materiales"
        size="md"
      >
        <p className="text-sm text-gray-700">{errorMessage}</p>
        <div className="flex justify-end mt-4">
          <Button primary onClick={() => setErrorMessage(null)}>
            Entendido
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default BomSummaryTab;
