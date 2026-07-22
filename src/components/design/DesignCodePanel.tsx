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
          className: "bg-slate-100 text-slate-600",
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        }
      : !preview
        ? {
            text: "Sin datos",
            className: "bg-slate-100 text-slate-500",
            icon: null,
          }
        : !preview.isComplete
          ? {
              text: `Falta ${missingLabels}`,
              className: "bg-amber-100 text-amber-700",
              icon: <TriangleAlert className="h-3.5 w-3.5" />,
            }
          : preview.isDuplicate && !isDuplicateResolved
            ? {
                text: "Código duplicado",
                className: "bg-red-100 text-red-700",
                icon: <TriangleAlert className="h-3.5 w-3.5" />,
              }
            : {
                text: "Completo",
                className: "bg-emerald-100 text-emerald-700",
                icon: <Check className="h-3.5 w-3.5" />,
              };

  const suffixFormat = preview?.suffixPattern
    ? (SUFFIX_FORMAT[preview.suffixPattern] ?? null)
    : null;

  return (
    <div className="w-full mb-5 bg-white rounded-2xl shadow-md border border-slate-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-700">
          Código de diseño
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}
          >
            {status.icon}
            {status.text}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!effectiveCode}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
      </div>

      {/* Chips de segmentos */}
      <div className="flex flex-wrap gap-1.5">
        {displaySegments.length === 0
          ? Array.from({ length: SKELETON_SEGMENT_COUNT }).map((_, idx) => (
              <div
                key={idx}
                className="w-14 h-11 rounded-lg bg-slate-100 animate-pulse"
              />
            ))
          : displaySegments.map((segment) => (
              <SegmentChip key={segment.key} segment={segment} />
            ))}
      </div>

      {/* Barra de progreso */}
      {displaySegments.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPercent === 100 ? "bg-emerald-500" : "bg-amber-400"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {resolvedSegments}/{totalSegments} segmentos
          </span>
        </div>
      )}

      {/* Código completo ensamblado */}
      {effectiveCode ? (
        <div className="font-mono text-base font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-center tracking-widest select-all">
          {effectiveCode}
        </div>
      ) : isLoading ? (
        <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
      ) : null}

      {/* Sección de desambiguación: solo cuando hay duplicado */}
      {preview?.isComplete && preview.isDuplicate && (
        <div className="space-y-2 pt-1">
          {/* Banner de aviso */}
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs leading-relaxed">
            El código <strong className="font-mono">{preview.baseCode}</strong>{" "}
            ya existe. Edita el sufijo de desambiguación (entre el año y el
            valor MO):
          </div>

          {/* Split input: [prefijo fijo] [sufijo editable] [resto fijo] */}
          <div className="flex items-stretch font-mono text-sm rounded-lg border border-amber-300 overflow-hidden">
            <span className="px-3 py-2.5 bg-amber-100 border-r border-amber-300 text-amber-900 select-none whitespace-nowrap">
              {yearPrefix}
            </span>
            <input
              value={editingToken}
              onChange={handleTokenInput}
              disabled={isVerifying || (!isEditing && verificationResult === "available")}
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
            <p className="text-xs text-slate-400">
              Formato esperado: <span className="font-medium">{suffixFormat.hint}</span>
            </p>
          )}

          {/* Acciones de edición */}
          {isEditing && !isVerifying && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleVerify}
                disabled={!editingToken.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Verificar disponibilidad
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Descartar cambios
              </button>
            </div>
          )}

          {/* Verificando... */}
          {isVerifying && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
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
    ? "bg-amber-50 border-amber-300 border-dashed text-amber-700 animate-pulse cursor-help"
    : isMoOrMd
      ? "bg-violet-50 border-violet-200 text-violet-700"
      : "bg-slate-50 border-slate-200 text-slate-700";

  return (
    <div
      className={`flex flex-col items-center justify-center min-w-14 h-11 px-2 rounded-lg border ${colorClasses}`}
      title={
        segment.isMissing
          ? `Falta etiquetar una celda como "${segment.label}" (clic derecho sobre la celda en la hoja de diseño)`
          : `${segment.label}: ${segment.value}`
      }
    >
      <span className="text-sm font-mono font-bold leading-tight flex items-center gap-0.5">
        {segment.isMissing && <Tag className="h-3 w-3" />}
        {segment.isMissing ? "?" : segment.value}
      </span>
      <span className="text-[9px] uppercase tracking-wide opacity-70 leading-tight">
        {segment.label}
      </span>
    </div>
  );
};

export default DesignCodePanel;
