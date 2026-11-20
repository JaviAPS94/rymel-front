import { useState } from "react";
import { ElementResponse } from "../../commons/types";
import ValuesList from "./ValuesList";
import ValueModal from "./ValueModal";
import Tooltip from "../core/Tooltip";
import { useNorm } from "../../hooks/useNorm";
import { Pagination } from "@rymel/ui";

interface DataTableProps {
  data: ElementResponse[];
  setBaseFields: React.Dispatch<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.SetStateAction<Record<string, Record<string, any>> | undefined>
  >;
  setSelectedSubType: React.Dispatch<React.SetStateAction<number | undefined>>;
}

const DataTable = ({
  data,
  setBaseFields,
  setSelectedSubType,
}: DataTableProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { [key: string]: any } | Record<string, any>[]
  >({});
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const itemsPerPage = 5;
  const { toogleShowAddElement, toogleShowAddElementButton } = useNorm();

  const openModal = (
    e: React.MouseEvent,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    values: { [key: string]: any } | Record<string, any>[],
  ) => {
    e.stopPropagation();
    setSelectedValues(values);
    setModalOpen(true);
  };

  const handleMouseEnter = (e: React.MouseEvent, id: number) => {
    setHoveredRow(id);
    setIsTooltipVisible(true);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isTooltipVisible) {
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredRow(null);
    setIsTooltipVisible(false);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);

  const totalPages = Math.ceil(data.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const deleteKey = (
    obj: Record<string, unknown>,
    keyToDelete: string,
  ): Record<string, unknown> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [keyToDelete]: _, ...rest } = obj; // Destructure to remove the key
    return rest; // Return the updated object
  };

  const handleRowClick = (id: number) => {
    setBaseFields({});
    const currentElement = data.find((element) => element.id === id);
    const transformedObject = currentElement?.values.reduce(
      (acc, { key, name, value, type }) => {
        acc[key] = { label: name, type };
        if (value) acc[key].value = value;
        return acc;
      },
      {} as Record<string, { label: string; type: string; value?: string }>,
    );
    setSelectedSubType(currentElement?.subType.id || 0);
    setBaseFields(deleteKey(transformedObject!, "accesories"));
    toogleShowAddElement();
    toogleShowAddElementButton();
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-semibold">ID</th>
              <th className="px-4 py-3 font-semibold">Valores</th>
              <th className="px-4 py-3 font-semibold">Subtipo</th>
              <th className="px-4 py-3 font-semibold">Norma</th>
              <th className="px-4 py-3 font-semibold">País</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No hay elementos para cargar con estos datos.
                </td>
              </tr>
            )}
            {currentItems.map((item) => (
              <tr
                key={item.id}
                onClick={() => handleRowClick(item.id)}
                onMouseEnter={(e) => handleMouseEnter(e, item.id)}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className={`cursor-pointer transition-colors ${
                  hoveredRow === item.id ? "bg-gray-50" : ""
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-600">
                  {item.id}
                </td>
                <td className="px-4 py-3">
                  <ValuesList
                    values={item.values}
                    setIsTooltipVisible={setIsTooltipVisible}
                  />
                  <button
                    onClick={(e) => openModal(e, item.values)}
                    className="mt-2 text-xs font-medium text-rymel-blue hover:underline"
                    onMouseEnter={() => {
                      setIsTooltipVisible(false);
                    }}
                    onMouseLeave={() => {
                      setIsTooltipVisible(true);
                    }}
                  >
                    Ver todos
                  </button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {item.subType.name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {item.norm.name} (v{item.norm.version})
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {item.norm.country.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 0 && (
        <p className="mt-3 text-sm text-gray-600">
          Mostrando <span className="font-medium">{indexOfFirstItem + 1}</span>{" "}
          a{" "}
          <span className="font-medium">
            {Math.min(indexOfLastItem, data.length)}
          </span>{" "}
          de <span className="font-medium">{data.length}</span> resultados
        </p>
      )}
      <div className="mt-3">
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          onPageChange={paginate}
        />
      </div>
      <ValueModal
        values={selectedValues}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
      <Tooltip
        text="Presiona aquí para cargar este elemento"
        visible={isTooltipVisible}
        position={tooltipPosition}
      />
    </div>
  );
};

export default DataTable;
