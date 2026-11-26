import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  Pencil,
  Tag,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  DesignCodeSegment,
  GenerateDesignCodeResponse,
} from "../../store/apis/designCodeApi";
import { useLazyCheckCodeAvailableQuery } from "../../store";

interface DesignCodePanelProps {
  isLoading: boolean;
  preview: GenerateDesignCodeResponse | null;
  /** Mensaje de error cuando la generación falló (p.ej. respuesta 400 del backend). */
  errorMessage?: string | null;
  /** Token de desambiguación confirmado (sugerencia del backend o último verificado). */
  disambiguationToken: string;
  /** Llamado cuando el usuario confirma un token único mediante verificación. */
  onTokenChange: (token: string) => void;
  /** Notifica al padre si hay cambios sin confirmar en el sufijo. */
  onEditingChange: (isEditing: boolean) => void;
}

const SKELETON_SEGMENT_COUNT = 9;

const YEAR_PREFIX_SEGMENT_KEYS = [
  "FASE",
  "POTENCIA",
  "TENSION_PRIMARIA",
  "TENSION_SECUNDARIA",
] as const;

/** Hint y placeholder por patrón de sufijo definido en backend. */
const SUFFIX_FORMAT: Record<string, { placeholder: string; hint: string }> = {
  LETTER_SUFFIX: {
    placeholder: "A",
    hint: "Letra A-Z (ej: A, B, C…)",
  },
  LETTER_SUFFIX_DASH: {
    placeholder: "-A",
    hint: "Guion + letra (ej: -A, -B…)",
  },
  NUMERIC_SUFFIX: {
    placeholder: "1",
    hint: "Número entero (ej: 1, 2, 3…)",
  },
  NUMERIC_SUFFIX_DASH: {
    placeholder: "-1",
    hint: "Guion + número (ej: -1, -2…)",
  },
};

const DesignCodePanel: React.FC<DesignCodePanelProps> = ({
  isLoading,
  preview,
  errorMessage,
  disambiguationToken,
  onTokenChange,
  onEditingChange,
}) => {
  const [copied, setCopied] = useState(false);
  // Token que el usuario está escribiendo (puede diferir del confirmado en el padre).
  const [editingToken, setEditingToken] = useState(disambiguationToken);
  // Resultado de la última verificación de disponibilidad.
  const [verificationResult, setVerificationResult] = useState<
    "available" | "taken" | null
  >(null);

  const [checkAvailability, checkResult] = useLazyCheckCodeAvailableQuery();
  const isVerifying = checkResult.isFetching;

  // "Editing" es cuando el usuario ha cambiado el token respecto al confirmado.
  const isEditing = editingToken !== disambiguationToken;

  // El segmento ANIO incluye el token sugerido (ej: "26A").
  // El año son siempre 2 dígitos fijos; lo que sigue es el token.
  const anioSegment =
    preview?.segments.find((s) => s.key === "ANIO")?.value ?? "";
  const baseYear = anioSegment.slice(0, 2);

  const yearPrefix = useMemo(() => {
    if (!preview?.segments) return "";
    const fixed = YEAR_PREFIX_SEGMENT_KEYS.map(
      (k) => preview.segments.find((s) => s.key === k)?.value ?? "",
    ).join("");
    return fixed + baseYear;
  }, [preview, baseYear]);

  const restSuffix = useMemo(() => {
    if (!preview?.baseCode) return "";
    return preview.baseCode.slice(yearPrefix.length);
  }, [preview, yearPrefix]);

  // Código efectivo a mostrar/copiar: usa el token que el usuario está editando.
  const effectiveCode = useMemo(() => {
    if (!preview) return "";
    if (preview.isDuplicate) {
      return `${yearPrefix}${editingToken}${restSuffix}`;
    }
    return preview.code;
  }, [preview, yearPrefix, editingToken, restSuffix]);

  // Cuando el token confirmado cambia (por nueva respuesta de la API o por confirmación),
  // sincronizamos el editor local y marcamos como "disponible" el token de la API
  // (el backend garantiza que su sugerencia siempre es libre).
  useEffect(() => {
    setEditingToken(disambiguationToken);
    setVerificationResult(disambiguationToken ? "available" : null);
  }, [disambiguationToken]);

  // Notifica al padre si el usuario tiene cambios sin confirmar.
  useEffect(() => {
    onEditingChange(isEditing);
  }, [isEditing, onEditingChange]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const handleCopy = () => {
    if (!effectiveCode) return;
    navigator.clipboard.writeText(effectiveCode).then(() => setCopied(true));
  };

  const handleTokenInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingToken(e.target.value);
    setVerificationResult(null);
  };

  const handleVerify = async () => {
    if (!editingToken.trim()) return;
    const codeToCheck = `${yearPrefix}${editingToken}${restSuffix}`;
    try {
      const result = await checkAvailability(codeToCheck, true).unwrap();
      if (result.isAvailable) {
        setVerificationResult("available");
        onTokenChange(editingToken);
        onEditingChange(false);
      } else {
        setVerificationResult("taken");
      }
    } catch {
      setVerificationResult(null);
    }
  };

  const handleDiscard = () => {
    setEditingToken(disambiguationToken);
    setVerificationResult(disambiguationToken ? "available" : null);
  };

  const handleEditAgain = () => {
    setVerificationResult(null);
    // No cambiamos editingToken para que el usuario parta del valor confirmado.
  };

  // Segmentos con el chip de ANIO sobreescrito para reflejar el token en edición.
  const displaySegments = useMemo(() => {
    if (!preview?.segments) return [];
    if (!preview.isDuplicate) return preview.segments;
    return preview.segments.map((seg) =>
      seg.key === "ANIO"
        ? { ...seg, value: `${baseYear}${editingToken}` }
        : seg,
    );
  }, [preview, baseYear, editingToken]);

  const totalSegments = displaySegments.length || SKELETON_SEGMENT_COUNT;
  const resolvedSegments = displaySegments.filter((s) => !s.isMissing).length;
  const progressPercent = displaySegments.length
    ? Math.round((resolvedSegments / totalSegments) * 100)
    : 0;

  const missingLabels = displaySegments
    .filter((s) => s.isMissing)
    .map((s) => s.label)
    .join(" y ");

  // El badge "Completo" se muestra cuando el token está verificado como disponible
  // (la sugerencia del backend y los tokens que el usuario confirma explícitamente).
  const isDuplicateResolved =
    preview?.isDuplicate && verificationResult === "available";

  const status: { text: string; className: string; icon: React.ReactNode } =
    isLoading
      ? {
          text: "Generando…",
          className: "bg-white/10 text-white/85",
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        }
      : errorMessage
        ? {
            text: "Error al generar",
            className: "bg-[#FF8A80]/15 text-[#FFB4AB]",
            icon: <TriangleAlert className="h-3.5 w-3.5" />,
          }
        : !preview
          ? {
              text: "Sin datos",
              className: "bg-white/10 text-white/80",
              icon: null,
            }
          : !preview.isComplete
            ? {
                text: `Falta ${missingLabels}`,
                className: "bg-rymel-yellow/[.16] text-rymel-yellow",
                icon: <TriangleAlert className="h-3.5 w-3.5" />,
              }
            : preview.isDuplicate && !isDuplicateResolved
              ? {
                  text: "Código duplicado",
                  className: "bg-[#FF8A80]/15 text-[#FFB4AB]",
                  icon: <TriangleAlert className="h-3.5 w-3.5" />,
                }
              : {
                  text: "Completo",
                  className: "bg-emerald-400/15 text-emerald-300",
                  icon: <Check className="h-3.5 w-3.5" />,
                };

  const suffixFormat = preview?.suffixPattern
    ? (SUFFIX_FORMAT[preview.suffixPattern] ?? null)
    : null;

  return (
    <div className="mb-5 flex w-full flex-col gap-5">
      <div className="flex flex-col gap-5 rounded-[18px] bg-rymel-blue p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="m-0 flex-auto text-base font-bold text-white">
            Código de diseño
          </h3>
          <span
            className={`inline-flex h-[34px] items-center gap-2 rounded-full px-3 text-[13px] font-bold ${status.className}`}
          >
            {status.icon}
            {status.text}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!effectiveCode}
            className="inline-flex h-[34px] items-center gap-2 rounded-[10px] border border-white/25 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            title="Copiar código"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>

        {/* Mensaje de error: reemplaza el código cuando la generación falló */}
        {!isLoading && errorMessage ? (
          <div className="flex items-start gap-2 rounded-xl bg-[#FF8A80]/15 px-4 py-3 text-sm leading-relaxed text-[#FFB4AB]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : effectiveCode ? (
          <div
            aria-label="Código resultante"
            className="select-all break-all text-center font-mono text-[28px] font-bold tracking-[0.06em] text-white sm:text-[40px]"
          >
            {/* Los segmentos que faltan («?») van en amarillo. */}
            {effectiveCode.split(/(\?+)/).map((part, index) =>
              part.startsWith("?") ? (
                <span key={index} className="text-rymel-yellow">
                  {part}
                </span>
              ) : (
                part
              ),
            )}
          </div>
        ) : isLoading ? (
          <div className="mx-auto h-12 w-2/3 animate-pulse rounded-lg bg-white/10" />
        ) : null}

        {/* Barra de progreso */}
        {!errorMessage && displaySegments.length > 0 && (
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[.14]"
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progressPercent === 100 ? "bg-emerald-400" : "bg-rymel-yellow"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-[13px] font-semibold text-white/85">
              {resolvedSegments} de {totalSegments} segmentos
            </span>
          </div>
        )}
      </div>

      {/* Segmentos */}
      {!(!isLoading && errorMessage) && (
        <div className="flex flex-wrap gap-2.5">
          {displaySegments.length === 0
            ? Array.from({ length: SKELETON_SEGMENT_COUNT }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-[72px] w-[84px] animate-pulse rounded-[14px] bg-gray-100"
                />
              ))
            : displaySegments.map((segment) => (
                <SegmentChip key={segment.key} segment={segment} />
              ))}
        </div>
      )}

      {/* Sección de desambiguación: solo cuando hay duplicado */}
      {preview?.isComplete && preview.isDuplicate && (
        <div className="space-y-2">
          {/* Banner de aviso */}
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs leading-relaxed">
            El código <strong className="font-mono">{preview.baseCode}</strong>{" "}
            ya existe. Edita el sufijo de desambiguación (entre el año y el
            valor de Material del Núcleo):
          </div>

          {/* Split input: [prefijo fijo] [sufijo editable] [resto fijo] */}
          <div className="flex items-stretch font-mono text-sm rounded-xl border border-amber-300 overflow-hidden">
            <span className="px-3 py-2.5 bg-amber-100 border-r border-amber-300 text-amber-900 select-none whitespace-nowrap">
              {yearPrefix}
            </span>
            <input
              value={editingToken}
              onChange={handleTokenInput}
              disabled={
                isVerifying ||
                (!isEditing && verificationResult === "available")
              }
              className="w-16 py-2.5 px-2 text-center font-bold text-amber-700 bg-white focus:outline-none focus:bg-amber-50 disabled:bg-amber-50 disabled:cursor-default"
              placeholder={suffixFormat?.placeholder ?? "A"}
              aria-label="Sufijo de desambiguación"
            />
            <span className="px-3 py-2.5 bg-amber-100 border-l border-amber-300 text-amber-900 select-none whitespace-nowrap">
              {restSuffix}
            </span>
          </div>

          {/* Hint del formato esperado */}
          {suffixFormat && (
            <p className="text-xs text-gray-600">
              Formato esperado:{" "}
              <span className="font-medium">{suffixFormat.hint}</span>
            </p>
          )}

          {/* Acciones de edición */}
          {isEditing && !isVerifying && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleVerify}
                disabled={!editingToken.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-bold bg-rymel-blue text-white hover:bg-rymel-indigo disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Verificar disponibilidad
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Descartar cambios
              </button>
            </div>
          )}

          {/* Verificando... */}
          {isVerifying && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verificando disponibilidad…
            </div>
          )}

          {/* Resultado disponible + botón de re-editar */}
          {!isEditing && verificationResult === "available" && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                Sufijo disponible — puedes guardar el diseño
              </div>
              <button
                type="button"
                onClick={handleEditAgain}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Cambiar
              </button>
            </div>
          )}

          {/* Resultado no disponible */}
          {verificationResult === "taken" && (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <TriangleAlert className="h-3.5 w-3.5" />
              Este sufijo también existe — prueba con otro valor
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SegmentChip: React.FC<{ segment: DesignCodeSegment }> = ({ segment }) => {
  const isMoOrMd = segment.key === "MO" || segment.key === "MATERIAL_DEVANADO";

  const colorClasses = segment.isMissing
    ? "border-[1.5px] border-dashed border-[#D9A91A] bg-[#FFF9E6] cursor-help"
    : isMoOrMd
      ? "border border-rymel-indigo/25 bg-rymel-tint"
      : "border border-gray-300 bg-white";

  return (
    <div
      className={`flex h-[72px] min-w-[84px] flex-col items-center justify-center gap-1 rounded-[14px] px-3.5 ${colorClasses}`}
      title={
        segment.isMissing
          ? `Falta etiquetar una celda como "${segment.label}" (clic derecho sobre la celda en la hoja de diseño)`
          : `${segment.label}: ${segment.value}`
      }
    >
      <span
        className={`flex items-center gap-1 font-mono text-xl font-bold leading-tight ${
          segment.isMissing ? "text-[#8A6500]" : "text-gray-900"
        }`}
      >
        {segment.isMissing && <Tag className="h-3.5 w-3.5" />}
        {segment.isMissing ? "?" : segment.value}
      </span>
      <span
        className={`whitespace-nowrap text-[10.5px] font-bold uppercase leading-tight tracking-[0.08em] ${
          segment.isMissing ? "text-[#7A5A00]" : "text-gray-600"
        }`}
      >
        {segment.label}
      </span>
    </div>
  );
};

export default DesignCodePanel;
