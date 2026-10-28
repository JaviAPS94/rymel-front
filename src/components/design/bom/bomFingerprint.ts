import { Cell } from "../spreadsheet-types";

/** JSON con las claves de los objetos ordenadas, para que el orden no cuente. */
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

/**
 * Huella de una lista generada, sin editar: SHA-256 en hexadecimal.
 *
 * Se guarda con los ajustes. Al abrirlos se vuelve a generar la lista y, si
 * la huella es otra, algo de lo que la alimenta —estructura BOM, hojas del
 * diseño, accesorios o catálogo— cambió desde que se ajustó.
 */
export const bomFingerprint = async (cells: { [key: string]: Cell }): Promise<string> => {
  const bytes = new TextEncoder().encode(canonical(cells));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};
