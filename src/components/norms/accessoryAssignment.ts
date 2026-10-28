import type { Accessory, SemiFinishedType } from "../../commons/types";
import type { NormElement } from "../../pages/NormPage";

/**
 * Los accesorios elegidos en una misma acción, listos para guardar en la
 * norma: todos con el semielaborado elegido, que es lo que los lleva a su
 * sección de la lista de materiales, y con cantidad 1 si no traen otra.
 */
export const pickAccessories = (
  catalog: Accessory[],
  ids: number[],
  semiFinished: SemiFinishedType,
): Accessory[] =>
  catalog
    .filter((accessory) => ids.includes(accessory.id))
    .map((accessory) => ({ ...accessory, value: accessory.value ?? 1, semiFinished }));

/**
 * Añade los accesorios a cada elemento seleccionado de la norma, sin repetir
 * los que ya tenga. Escribe sobre `elements`, como hacía el formulario.
 */
export const addAccessoriesToElements = (
  elements: NormElement[],
  selectedReferences: string[],
  accessories: Accessory[],
): void => {
  selectedReferences.forEach((reference) => {
    const element = elements.find((el) => el.sapReference === reference);
    if (!element) return;

    const field = element.values.find((v) => v.key === "accesories");
    if (!field) {
      element.values.push({
        key: "accesories",
        name: "Accesorios",
        sapReference: false,
        validations: {},
        descriptionInfo: "Accesorios del elemento",
        value: [...accessories],
        type: "object",
      });
      return;
    }
    if (!Array.isArray(field.value)) return;
    const current = field.value as object[];
    const added = accessories.filter(
      (accessory) => !current.some((existing) => JSON.stringify(existing) === JSON.stringify(accessory)),
    );
    field.value = [...current, ...added];
  });
};
