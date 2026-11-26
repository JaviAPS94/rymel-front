import { BiTrash } from "react-icons/bi";
import { Accessory } from "../../commons/types";
import { FormData } from "./ElementForm";

interface AccesoriesTableProps {
  accessories: Accessory[] | undefined;
  setFormData?: React.Dispatch<React.SetStateAction<FormData>>;
  showDelete?: boolean;
}

const AccesoriesTable = ({
  accessories,
  setFormData,
  showDelete = false,
}: AccesoriesTableProps) => {
  const handleDeleteAccesoryById = (id: number) => {
    setFormData?.((prevData) => ({
      ...prevData,
      customFields: prevData.customFields
        .map((field) =>
          field.key === "accesories"
            ? {
                ...field,
                value: Array.isArray(field.value)
                  ? field.value.filter((accessory) => accessory.id !== id)
                  : field.value,
              }
            : field,
        )
        .filter(
          (field) =>
            field.key !== "accesories" ||
            (Array.isArray(field.value) && field.value.length > 0),
        ),
    }));
  };

  const handleValueChange = (id: number, newValue: number) => {
    setFormData?.((prevData) => ({
      ...prevData,
      customFields: prevData.customFields.map((field) =>
        field.key === "accesories"
          ? {
              ...field,
              value: Array.isArray(field.value)
                ? field.value.map((accessory) =>
                    accessory.id === id
                      ? { ...accessory, value: newValue }
                      : accessory,
                  )
                : field.value,
            }
          : field,
      ),
    }));
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="px-4 py-3 font-semibold">Item</th>
            <th className="px-4 py-3 font-semibold">Descripción</th>
            <th className="px-4 py-3 font-semibold">Referencia</th>
            <th className="px-4 py-3 font-semibold">Unidad de Medida</th>
            <th className="px-4 py-3 font-semibold">Valor</th>
            <th className="px-4 py-3 font-semibold">Semi Elaborado</th>
            {showDelete && (
              <th className="px-4 py-3 font-semibold">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {accessories?.map((accessory) => (
            <tr key={accessory.id}>
              <td className="px-4 py-3">{accessory.id}</td>
              <td className="px-4 py-3">{accessory.description}</td>
              <td className="px-4 py-3">{accessory.reference}</td>
              <td className="px-4 py-3">{accessory.unitOfMeasurement}</td>
              <td className="px-4 py-3">
                {showDelete ? (
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={accessory.value ?? 1}
                    onChange={(e) =>
                      handleValueChange(accessory.id, Number(e.target.value))
                    }
                    className="w-20 rounded-md border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-rymel-blue"
                  />
                ) : (
                  (accessory.value ?? 1)
                )}
              </td>
              <td className="px-4 py-3">{accessory.semiFinished?.code}</td>
              {showDelete && (
                <td className="px-4 py-3">
                  <button
                    type="button"
                    title="Quitar accesorio"
                    aria-label={`Quitar accesorio ${accessory.description}`}
                    onClick={() => handleDeleteAccesoryById(accessory.id)}
                    className="rounded p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <BiTrash className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AccesoriesTable;
