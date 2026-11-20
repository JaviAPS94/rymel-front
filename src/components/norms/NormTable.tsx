import React from "react";
import { useNavigate } from "react-router-dom";
import { TbAlertTriangle, TbPencil } from "react-icons/tb";
import { CompleteElementData, NormCompleteData } from "../../commons/types";
import CountryFlag from "../core/CountryFlag";
import { Badge, IconButton, RowIcon, TableCard, Tag } from "@rymel/ui";

interface NormTableProps {
  items: NormCompleteData[];
  /** Pie de la tarjeta: la paginación. */
  footer?: React.ReactNode;
}

const empty = <span className="text-gray-600">—</span>;

/** Iniciales de la norma para su ficha: «NTCA» → «NT». */
const initials = (name: string) =>
  name
    .replace(/[^\p{L}\p{N}]/gu, "")
    .slice(0, 2)
    .toUpperCase();

type SubTypeSummary = { id: number; name: string; count: number };

/** Subtipos de la norma con cuántos elementos tiene cada uno. */
const summarizeSubTypes = (elements: CompleteElementData[]) => {
  const bySubType = new Map<number, SubTypeSummary>();
  for (const { subType } of elements) {
    const entry = bySubType.get(subType.id);
    if (entry) entry.count += 1;
    else bySubType.set(subType.id, { ...subType, count: 1 });
  }
  return [...bySubType.values()].sort((a, b) => a.name.localeCompare(b.name));
};

const NormTable: React.FC<NormTableProps> = ({ items, footer }) => {
  const navigate = useNavigate();

  const goToEdit = (id: number) => navigate(`/norms/edit/${id}`);

  return (
    <TableCard aria-label="Normas" footer={footer} minWidth={1100}>
      <table className="rm-table">
        <thead>
          <tr>
            <th>Norma</th>
            <th>País</th>
            <th>Versión</th>
            <th>Especificación</th>
            <th>Subtipos</th>
            <th data-align="right">Elementos</th>
            <th>Ref. SAP</th>
            <th>Documento</th>
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const elements = item.elements ?? [];
            const subTypes = summarizeSubTypes(elements);
            const withSap = elements.filter((e) => e.sapReference).length;
            const specification = item.normSpecification;

            return (
              <tr
                key={item.id}
                onClick={() => goToEdit(item.id)}
                className="cursor-pointer"
              >
                <td>
                  <div className="flex items-center gap-3">
                    <RowIcon>{initials(item.name)}</RowIcon>
                    <div>
                      <div className="font-bold text-gray-900">{item.name}</div>
                      {elements.length === 0 && (
                        <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-warning">
                          <TbAlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Sin elementos cargados
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2.5 whitespace-nowrap">
                    <CountryFlag
                      isoCode={item.country.isoCode}
                      className="h-4 w-6 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,.06)]"
                    />
                    {item.country.name}
                  </div>
                </td>
                <td className="whitespace-nowrap">
                  <Tag mono>{item.version}</Tag>
                </td>
                <td className="text-gray-600">
                  {specification ? (
                    <>
                      <div>{specification.name}</div>
                      {specification.code && (
                        <div className="font-mono text-xs text-gray-600">
                          {specification.code}
                        </div>
                      )}
                    </>
                  ) : (
                    empty
                  )}
                </td>
                <td>
                  {subTypes.length > 0 ? (
                    <div className="flex max-w-[380px] flex-wrap gap-1.5">
                      {subTypes.map((subType) => (
                        <Badge
                          key={subType.id}
                          tone="brand"
                          count={
                            subType.count > 1 ? `×${subType.count}` : undefined
                          }
                          title={`${subType.count} elemento${subType.count === 1 ? "" : "s"}`}
                        >
                          {subType.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    empty
                  )}
                </td>
                <td
                  data-align="right"
                  className={`font-bold tabular-nums ${
                    elements.length === 0 ? "text-warning" : ""
                  }`}
                >
                  {elements.length}
                </td>
                <td className="whitespace-nowrap font-semibold tabular-nums">
                  {elements.length > 0
                    ? `${withSap} / ${elements.length}`
                    : empty}
                </td>
                <td>
                  <Badge tone={item.normFile ? "success" : "neutral"}>
                    {item.normFile ? "Adjunto" : "Sin archivo"}
                  </Badge>
                </td>
                <td>
                  <div className="flex justify-end">
                    <IconButton
                      label={`Editar norma ${item.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        goToEdit(item.id);
                      }}
                    >
                      <TbPencil className="h-4 w-4" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
};

export default NormTable;
