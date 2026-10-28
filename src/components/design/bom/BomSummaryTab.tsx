import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, Loader2, Pencil, RefreshCw, RotateCcw, Save, X } from "lucide-react";
import { BomResponse, DesignSubtype, ElementResponse, Template } from "../../../commons/types";
import {
  useDeleteBomAdjustmentMutation,
  useLazyGetBomAdjustmentQuery,
  useLazyGetBomByCodeQuery,
  useSaveBomAdjustmentMutation,
} from "../../../store";
import type { BomAdjustment } from "../../../store/apis/bomAdjustmentApi";
import { Cell, Sheet } from "../spreadsheet-types";
import Button from "../../core/Button";
import { Modal } from "../../core/Modal";
import SpreadSheet from "../SpreadSheet";
import {
  BOM_SUMMARY_COLUMN_WIDTHS,
  bomFingerprint,
  buildBomSummaryCells,
  evaluateBomBase,
  withAccessories,
  type BomSummaryCell,
} from "@rymel/design-template";

interface BomSummaryTabProps {
  element: ElementResponse;
  sheets: Sheet[]; // design sheets, used to resolve item catalogs / semi-finished zones
  subTypeWithFunctions: DesignSubtype;
  // Diseño guardado al que pertenecen los ajustes; null si aún no se guardó
  designId: number | null;
}

type Cells = { [key: string]: Cell };
// La lista tal como sale de la estructura, antes de editarla
type GeneratedCells = { [key: string]: BomSummaryCell };

// No design templates apply to the generated BOM workbook.
const NO_TEMPLATES: Template[] = [];

// Un id nuevo vuelve a montar la hoja, y con ello se vacía su historial de
// deshacer: lo que se deshaga en lectura no puede volver a lo editado.
const sheetFromCells = (cells: Cells): Sheet => ({
  id: `bom-sheet-${Date.now()}`,
  name: "Lista de Materiales",
  cells,
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

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });

const BomSummaryTab = ({ element, sheets, subTypeWithFunctions, designId }: BomSummaryTabProps) => {
  const [triggerGetBom, { isFetching }] = useLazyGetBomByCodeQuery();
  const [triggerGetAdjustment] = useLazyGetBomAdjustmentQuery();
  const [saveAdjustment, { isLoading: isSaving }] = useSaveBomAdjustmentMutation();
  const [deleteAdjustment, { isLoading: isDeleting }] = useDeleteBomAdjustmentMutation();

  const [bomData, setBomData] = useState<BomResponse | null>(null);
  const [expandedChildNodes, setExpandedChildNodes] = useState<Set<number>>(
    new Set(),
  );
  // La lista tal como sale de la estructura, sin editar: de ella sale la huella
  const [generatedCells, setGeneratedCells] = useState<GeneratedCells | null>(null);
  const [adjustment, setAdjustment] = useState<BomAdjustment | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [cellsBeforeEdit, setCellsBeforeEdit] = useState<Cells | null>(null);
  const [bomSheets, setBomSheets] = useState<Sheet[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  // Con lista base en la plantilla, la lista es esa base —calculada con los
  // valores del diseño— más los accesorios de la norma del elemento. Sin
  // base, se genera desde la estructura de la referencia, como siempre.
  const baseSheet = useMemo(() => sheets.find((sheet) => sheet.billOfMaterials), [sheets]);
  const marker = baseSheet?.billOfMaterials;
  const [baseCells, setBaseCells] = useState<GeneratedCells | null>(null);
  // Se calcula con los valores actuales de las hojas del diseño: el `computed`
  // guardado de la base no se recalcula al editar las demás hojas
  useEffect(() => {
    if (!baseSheet) {
      setBaseCells(null);
      return;
    }
    let cancelled = false;
    evaluateBomBase(baseSheet, sheets)
      .then((evaluated) => {
        if (!cancelled) setBaseCells(withAccessories(evaluated, element) as GeneratedCells);
      })
      .catch((err) => console.error("[BOM] no se pudo calcular la lista base:", err));
    return () => {
      cancelled = true;
    };
  }, [baseSheet, sheets, element]);
  const baseFingerprint = useMemo(() => (baseCells ? bomFingerprint(baseCells) : null), [baseCells]);
  const [structureNotice, setStructureNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), 4000);
    return () => clearTimeout(timer);
  }, [hint]);

  const showCells = (cells: Cells) => setBomSheets([sheetFromCells(cells)]);

  // La base se muestra sola, y se vuelve a mostrar cuando cambian los valores
  // del diseño, salvo que haya un ajuste o se esté editando
  useEffect(() => {
    if (!baseCells || adjustment || editing) return;
    setGeneratedCells(baseCells);
    showCells(baseCells);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFingerprint, adjustment, editing]);

  // La base usa la estructura que eligió el admin; si la referencia del
  // elemento apunta a otra, se avisa
  useEffect(() => {
    setStructureNotice(null);
    if (!marker || !element.sapReference) return;
    let cancelled = false;
    triggerGetBom(element.sapReference).then((result) => {
      if (cancelled || !result.data || result.data.id === marker.structureId) return;
      setStructureNotice(
        `La referencia ERP del elemento corresponde a la estructura ${result.data.code}; la lista usa ${marker.structureCode}, la que eligió el administrador en la plantilla.`,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [marker, element.sapReference, triggerGetBom]);

  /**
   * Vuelve a generar la lista sobre la que se hizo el ajuste y la compara con
   * la huella guardada. Solo avisa: los ajustes no se tocan.
   */
  const checkStale = useCallback(
    async (saved: BomAdjustment) => {
      if (marker) {
        if (marker.structureId !== saved.bomId) {
          setStaleNotice("La lista base de la plantilla usa otra estructura que la de estos ajustes.");
        } else if (baseFingerprint && baseFingerprint !== saved.baseFingerprint) {
          setStaleNotice(
            "La lista cambió desde que se hicieron estos ajustes (lista base de la plantilla, valores del diseño o accesorios).",
          );
        }
        return;
      }
      let bom: BomResponse | null = null;
      if (element.sapReference) {
        try {
          bom = (await triggerGetBom(element.sapReference)).data ?? null;
        } catch (err) {
          console.error("[BOM] no se pudo comprobar la lista ajustada:", err);
          return;
        }
      }
      if (!bom || bom.id !== saved.bomId) {
        setStaleNotice(
          "La estructura BOM con la que se ajustó esta lista ya no corresponde a la referencia ERP del elemento.",
        );
        return;
      }
      try {
        const cells = buildBomSummaryCells(bom, new Set(saved.expandedNodes), sheets, element);
        if (bomFingerprint(cells) !== saved.baseFingerprint) {
          setStaleNotice(
            "La lista generada cambió desde que se hicieron estos ajustes (estructura BOM, hojas del diseño, accesorios o catálogo).",
          );
        }
      } catch (err) {
        console.error("[BOM] buildBomSummaryCells falló al comprobar:", err);
      }
    },
    [element, sheets, triggerGetBom, marker, baseFingerprint],
  );

  // Al abrir un diseño guardado, si tiene ajustes, se muestran
  useEffect(() => {
    if (!designId) return;
    let cancelled = false;
    (async () => {
      const result = await triggerGetAdjustment(designId);
      if (cancelled) return;
      if (result.data) {
        setAdjustment(result.data);
        setStaleNotice(null);
        showCells(result.data.cells);
        checkStale(result.data);
      } else if ((result.error as { status?: number } | undefined)?.status !== 404) {
        console.error("[BOM] no se pudieron cargar los ajustes:", result.error);
        setErrorMessage("No se pudieron cargar los ajustes guardados de la lista de materiales.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Solo al cambiar de diseño: volver a comprobar con cada cambio de hojas
    // pisaría lo que se está viendo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId]);

  const handleGenerate = async () => {
    if (!element.sapReference) {
      console.error("[BOM] element.sapReference is not set", element);
      setErrorMessage(
        "Este elemento no tiene referencia ERP configurada. No se puede generar la lista de materiales.",
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
        `No se encontró estructura BOM para la referencia ERP: ${element.sapReference}`,
      );
      return;
    }

    // Armar la hoja también puede fallar: depende de la forma de los datos del
    // elemento, del diseño y del catálogo, y ninguno de los tres se valida
    // aquí. Sin este `try`, el fallo salía como promesa rechazada en la
    // consola y en pantalla no ocurría nada: el usuario pulsaba «Generar» y se
    // quedaba mirando un panel vacío, sin saber si estaba cargando.
    const freshExpanded = new Set<number>();
    let cells: GeneratedCells;
    try {
      cells = buildBomSummaryCells(result.data, freshExpanded, sheets, element);
    } catch (err) {
      console.error("[BOM] buildBomSummaryCells falló:", err);
      setErrorMessage(
        "No se pudo armar la lista de materiales con los datos de este diseño. " +
          "Revisa que el elemento tenga sus características técnicas cargadas y " +
          "vuelve a intentarlo.",
      );
      return;
    }

    setBomData(result.data);
    setExpandedChildNodes(freshExpanded);
    setGeneratedCells(cells);
    showCells(cells);
  };

  // Clicking the ▶/▼ cell in column A of a child SF row expands/collapses
  // that node's items inline, without touching the rest of the sheet (same
  // sheet id, so the SpreadSheet instance doesn't remount). Solo en la lista
  // generada y en lectura: rearmar la hoja perdería lo editado o lo ajustado.
  const handleBomCellClick = (_cellRef: string, cell: Cell | undefined) => {
    if (cell?.bomToggleNodeId === undefined) return false;
    if (editing) {
      setHint("Guarda o descarta la edición para desplegar o plegar semielaborados.");
      return true;
    }
    if (adjustment) {
      setHint("La lista ajustada se guarda tal cual; para desplegar, vuelve a la lista generada o edítala.");
      return true;
    }
    if (!bomData) return false;
    const nodeId = cell.bomToggleNodeId;
    const next = new Set(expandedChildNodes);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    let freshCells: GeneratedCells;
    try {
      freshCells = buildBomSummaryCells(bomData, next, sheets, element);
    } catch (err) {
      console.error("[BOM] buildBomSummaryCells falló al expandir:", err);
      setErrorMessage("No se pudo expandir este semielaborado.");
      return true;
    }

    setExpandedChildNodes(next);
    setGeneratedCells(freshCells);
    setBomSheets((prev) =>
      prev.map((s, i) => (i === 0 ? { ...s, cells: freshCells } : s)),
    );
    return true;
  };

  const handleStartEdit = () => {
    setCellsBeforeEdit(bomSheets[0]?.cells ?? null);
    setEditing(true);
  };

  const handleDiscard = () => {
    if (cellsBeforeEdit) showCells(cellsBeforeEdit);
    setEditing(false);
  };

  const handleSave = async () => {
    if (!designId || !bomSheets[0]) return;
    // Sobre una lista ya ajustada, la base sigue siendo la del primer ajuste:
    // volver a guardar no hace que una lista vieja deje de serlo
    let base: { bomId: number; baseFingerprint: string; expandedNodes: number[] };
    if (adjustment) {
      base = {
        bomId: adjustment.bomId,
        baseFingerprint: adjustment.baseFingerprint,
        expandedNodes: adjustment.expandedNodes,
      };
    } else if (marker && baseCells) {
      base = { bomId: marker.structureId, baseFingerprint: bomFingerprint(baseCells), expandedNodes: [] };
    } else {
      if (!bomData || !generatedCells) return;
      base = {
        bomId: bomData.id,
        baseFingerprint: bomFingerprint(generatedCells),
        expandedNodes: Array.from(expandedChildNodes),
      };
    }
    const result = await saveAdjustment({ designId, ...base, cells: bomSheets[0].cells });
    if ("error" in result) {
      console.error("[BOM] no se pudieron guardar los ajustes:", result.error);
      setErrorMessage("No se pudieron guardar los ajustes. Lo editado sigue en pantalla; vuelve a intentarlo.");
      return;
    }
    setAdjustment(result.data);
    setEditing(false);
    showCells(result.data.cells);
  };

  const handleResetToGenerated = async () => {
    setConfirmReset(false);
    if (!designId) return;
    const result = await deleteAdjustment(designId);
    if ("error" in result) {
      console.error("[BOM] no se pudieron borrar los ajustes:", result.error);
      setErrorMessage("No se pudieron borrar los ajustes guardados.");
      return;
    }
    setAdjustment(null);
    setStaleNotice(null);
    // Con base, se vuelve a mostrar sola
    if (marker) return;
    setBomSheets([]);
    await handleGenerate();
  };

  const hasSheet = bomSheets.length > 0;

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
              {adjustment && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Ajustada
                </span>
              )}
              {editing && (
                <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                  Editando
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {editing
                ? designId
                  ? "Haz los ajustes y guárdalos con el diseño, o descártalos."
                  : "Guarda el diseño para poder guardar estos ajustes."
                : adjustment
                  ? `Ajustada${adjustment.updatedBy ? ` por ${adjustment.updatedBy}` : ""} el ${formatDate(adjustment.updatedAt)}. La estructura se define en el administrador.`
                  : marker
                    ? `Base de la plantilla (estructura ${marker.structureCode}) con los accesorios del elemento. Pulsa «Editar» para añadir filas o ajustarla.`
                    : hasSheet
                    ? "Generada a partir de la referencia ERP del elemento. Pulsa «Editar» para ajustarla."
                    : "Construye el desglose de materiales de este diseño a partir de su referencia ERP."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {editing ? (
            <>
              <Button
                onClick={handleSave}
                disabled={!designId || isSaving}
                title={designId ? undefined : "Guarda el diseño primero"}
                className="rounded-xl h-[2.8rem] bg-violet-600 border-violet-600 hover:bg-violet-700 hover:border-violet-700 text-white"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar ajustes
              </Button>
              <Button onClick={handleDiscard} disabled={isSaving} className="rounded-xl h-[2.8rem]">
                <X className="h-4 w-4" />
                Descartar
              </Button>
            </>
          ) : (
            <>
              {hasSheet && (
                <Button onClick={handleStartEdit} className="rounded-xl h-[2.8rem]">
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
              )}
              {adjustment ? (
                <Button
                  onClick={() => setConfirmReset(true)}
                  disabled={isDeleting || isFetching}
                  className="rounded-xl h-[2.8rem]"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Volver a la lista generada
                </Button>
              ) : marker ? null : (
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
                    : hasSheet
                      ? "Actualizar Lista de Materiales"
                      : "Generar Lista de Materiales"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {staleNotice && adjustment && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {staleNotice} Los ajustes se conservan; revisa la lista o vuelve a la generada.
          </span>
        </div>
      )}

      {structureNotice && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{structureNotice}</span>
        </div>
      )}

      {hint && <p className="text-xs text-slate-500 px-1">{hint}</p>}

      {hasSheet && (
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
          readOnly={!editing}
          readOnlyMessage="La lista está en solo lectura. Pulsa «Editar» para ajustarla."
        />
      )}

      <Modal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="¿Volver a la lista generada?"
        size="md"
      >
        <p className="text-sm text-gray-700">
          Se borrarán los ajustes guardados de este diseño y se mostrará la lista tal como sale de su estructura BOM. No se puede deshacer.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={() => setConfirmReset(false)}>Cancelar</Button>
          <Button primary onClick={handleResetToGenerated}>
            Borrar ajustes
          </Button>
        </div>
      </Modal>

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
