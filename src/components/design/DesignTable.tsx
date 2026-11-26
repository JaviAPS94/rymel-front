import type { ReactNode } from "react";
import { TbArrowRight, TbFileText } from "react-icons/tb";
import { Badge, Button, TableCard, Tag, TitleCell } from "@rymel/ui";
import { Design } from "../../commons/types";
import CountryFlag from "../core/CountryFlag";

interface DesignTableProps {
  items: Design[];
  onSelect: (design: Design) => void;
  /** Pie de la tarjeta: la paginación. */
  footer?: ReactNode;
}

const empty = <span className="text-gray-600">—</span>;

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const DesignTable = ({ items, onSelect, footer }: DesignTableProps) => (
  <TableCard aria-label="Resultados" footer={footer}>
    <table className="rm-table">
      <thead>
        <tr>
          <th>Diseño</th>
          <th>Tipo</th>
          <th>Subtipo</th>
          <th>Norma</th>
          <th data-align="right">Elementos</th>
          <th data-align="right">Sub-diseños</th>
          <th>Actualizado</th>
          <th>
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((design) => {
          // La norma del diseño es la de sus elementos.
          const norm = design.designElements[0]?.element.norm;
          const type = design.designSubType?.designType.name;
          const subType = design.designSubType?.name;

          return (
            <tr
              key={design.id}
              onClick={() => onSelect(design)}
              className="group cursor-pointer"
            >
              <td>
                <TitleCell
                  icon={<TbFileText className="h-[18px] w-[18px]" />}
                  title={design.name}
                  code={design.code}
                />
              </td>
              <td>{type ? <Badge dot>{type}</Badge> : empty}</td>
              <td>{subType ? <Tag>{subType}</Tag> : empty}</td>
              <td>
                {norm ? (
                  <div className="flex items-center gap-2.5 font-semibold">
                    <CountryFlag
                      isoCode={norm.country.isoCode}
                      className="h-4 w-6 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,.06)]"
                    />
                    {norm.name}
                  </div>
                ) : (
                  empty
                )}
              </td>
              <td data-align="right" className="font-semibold tabular-nums">
                {design.designElements.length}
              </td>
              <td data-align="right" className="font-semibold tabular-nums">
                {design.subDesigns.length}
              </td>
              <td className="whitespace-nowrap text-gray-600">
                {formatDate(design.updatedAt)}
              </td>
              <td data-align="right">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Ver ${design.code}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(design);
                  }}
                  className="text-rymel-blue group-hover:border-rymel-blue group-hover:bg-rymel-blue group-hover:text-white"
                >
                  Ver
                  <TbArrowRight className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </TableCard>
);

export default DesignTable;
