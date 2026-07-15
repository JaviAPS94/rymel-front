import { BiTrash } from "react-icons/bi";
import { Accessory } from "../../commons/types";
import Button from "../core/Button";
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
            : field
        )
        .filter(
          (field) =>
            field.key !== "accesories" ||
            (Array.isArray(field.value) && field.value.length > 0)
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
                      : accessory
                  )
                : field.value,
            }
          : field
      ),
    }));
  };

  return (
    <table className="min-w-full border-collapse border border-gray-300">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-300 px-4 py-2 text-left">Item</th>
          <th className="border border-gray-300 px-4 py-2 text-left">
            Descripción
          </th>
          <th className="border border-gray-300 px-4 py-2 text-left">
            Referencia
          </th>
          <th className="border border-gray-300 px-4 py-2 text-left">
            Unidad de Medida
          </th>
          <th className="border border-gray-300 px-4 py-2 text-left">
            Valor
          </th>
          <th className="border border-gray-300 px-4 py-2 text-left">
            Semi Elaborado
          </th>
          {showDelete && (
            <th className="border border-gray-300 px-4 py-2 text-left">
              Acciones
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {accessories?.map((accessory) => (
          <tr key={accessory.id} className="odd:bg-white even:bg-gray-50">
            <td className="border border-gray-300 px-4 py-2">{accessory.id}</td>
            <td className="border border-gray-300 px-4 py-2">
              {accessory.description}
            </td>
            <td className="border border-gray-300 px-4 py-2">
              {accessory.reference}
            </td>
            <td className="border border-gray-300 px-4 py-2">
              {accessory.unitOfMeasurement}
            </td>
            <td className="border border-gray-300 px-4 py-2">
              {showDelete ? (
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={accessory.value ?? 1}
                  onChange={(e) =>
                    handleValueChange(accessory.id, Number(e.target.value))
                  }
                  className="w-20 rounded-md border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                accessory.value ?? 1
              )}
            </td>
            <td className="border border-gray-300 px-4 py-2">
              {accessory.semiFinished?.code}
            </td>
            {showDelete && (
              <td className="border border-gray-300 px-4 py-2">
                <Button
                  danger
                  onClick={() => handleDeleteAccesoryById(accessory.id)}
                  className="px-3 py-1 text-white bg-red-500 rounded hover:bg-red-600"
                  icon={<BiTrash />}
                >
                  Quitar
                </Button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default AccesoriesTable;
