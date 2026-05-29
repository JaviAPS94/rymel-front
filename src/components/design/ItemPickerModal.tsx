import React, { useEffect, useMemo, useState } from "react";
import { CellItemLink, ItemCatalogTable } from "./spreadsheet-types";

export interface CatalogEntry {
  table: ItemCatalogTable;
  sheetId: string;
  sheetName: string;
  rows: Array<{ itemId: string; description: string; um: string }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (link: CellItemLink) => void;
  catalogs: CatalogEntry[];
  // Header info — purely cosmetic.
  targetCellRef?: string;
  // True when condition cells filtered the catalogs to fewer than the workbook total.
  // Lets the modal show "Filtrado por condiciones · ver todos los catálogos".
  filteredByConditions?: boolean;
  // Callback to widen the search to all catalogs in the workbook.
  onShowAll?: () => void;
}

const ItemPickerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelect,
  catalogs,
  targetCellRef,
  filteredByConditions = false,
  onShowAll,
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [search, setSearch] = useState("");

  // Reset state when the modal opens or the catalog list changes.
  useEffect(() => {
    if (isOpen) {
      setActiveIdx(0);
      setSearch("");
    }
  }, [isOpen, catalogs]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const activeCatalog = catalogs[activeIdx];

  const filteredRows = useMemo(() => {
    if (!activeCatalog) return [];
    const q = search.trim().toLowerCase();
    if (!q) return activeCatalog.rows;
    return activeCatalog.rows.filter(
      (r) =>
        r.itemId.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.um.toLowerCase().includes(q),
    );
  }, [activeCatalog, search]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-40 z-50"
        onClick={onClose}
      />
      <div
        className="fixed z-50 bg-white border border-gray-300 shadow-2xl rounded-lg flex flex-col"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(720px, 92vw)",
          maxHeight: "82vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              🔗 Vincular a item del catálogo
              {targetCellRef && (
                <span className="ml-2 font-mono text-cyan-700">
                  {targetCellRef}
                </span>
              )}
            </h3>
            {filteredByConditions && onShowAll && (
              <button
                className="text-xs text-cyan-600 hover:underline mt-0.5"
                onClick={onShowAll}
              >
                Filtrado por condiciones · ver todos los catálogos
              </button>
            )}
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 text-lg"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {catalogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No hay catálogos disponibles. Define una tabla catálogo primero
            (clic derecho en un rango → "Marcar como tabla de catálogo").
          </div>
        ) : (
          <>
            {/* Tabs (only if multiple catalogs match) */}
            {catalogs.length > 1 && (
              <div className="flex flex-wrap gap-1 px-3 pt-2 border-b">
                {catalogs.map((c, i) => (
                  <button
                    key={c.table.id}
                    onClick={() => setActiveIdx(i)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-t border-x border-t -mb-px ${
                      i === activeIdx
                        ? "bg-white border-gray-300 text-cyan-700"
                        : "bg-gray-50 border-transparent text-gray-600 hover:bg-gray-100"
                    }`}
                    title={`${c.sheetName} · ${c.rows.length} items`}
                  >
                    {c.table.name}
                    <span className="ml-1.5 text-[10px] text-gray-400">
                      {c.rows.length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Search bar */}
            <div className="px-4 pt-3">
              <input
                className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                placeholder="Buscar por ID, descripción o U.M..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {activeCatalog && (
                <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-2">
                  <span>📄 Hoja: {activeCatalog.sheetName}</span>
                  <span>·</span>
                  <span>
                    Rango: {activeCatalog.table.startCell}:
                    {activeCatalog.table.endCell}
                  </span>
                  {(activeCatalog.table.tags?.length ?? 0) > 0 && (
                    <>
                      <span>·</span>
                      <span>
                        Tags:{" "}
                        {activeCatalog.table.tags!.map((t) => (
                          <span
                            key={t}
                            className="inline-block bg-cyan-100 text-cyan-700 rounded px-1.5 ml-1"
                          >
                            {t}
                          </span>
                        ))}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
              {filteredRows.length === 0 ? (
                <div className="text-sm text-gray-400 italic text-center py-6">
                  {search
                    ? `Sin resultados para "${search}".`
                    : "Este catálogo no tiene filas de datos."}
                </div>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-blue-50 text-gray-700 sticky top-0">
                      <th className="border border-gray-300 px-2 py-1 text-left w-28">
                        Item ID
                      </th>
                      <th className="border border-gray-300 px-2 py-1 text-left">
                        Descripción
                      </th>
                      <th className="border border-gray-300 px-2 py-1 text-left w-20">
                        U.M.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr
                        key={row.itemId}
                        onClick={() =>
                          onSelect({
                            catalogSheetId: activeCatalog!.sheetId,
                            catalogTableId: activeCatalog!.table.id,
                            itemId: row.itemId,
                          })
                        }
                        className="cursor-pointer hover:bg-cyan-50 transition-colors"
                      >
                        <td className="border border-gray-200 px-2 py-1 font-mono">
                          {row.itemId}
                        </td>
                        <td className="border border-gray-200 px-2 py-1">
                          {row.description}
                        </td>
                        <td className="border border-gray-200 px-2 py-1">
                          {row.um}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-2.5 border-t bg-gray-50">
          <button
            className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-100"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
};

export default ItemPickerModal;
