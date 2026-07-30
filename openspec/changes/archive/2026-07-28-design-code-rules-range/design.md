## Context

El módulo `design-code-rules` (`project-back/src/modules/design-code-rules/`) resuelve, para cada segmento del código de diseño, la letra que corresponde a un valor numérico del elemento (potencia en kVA, tensión primaria, tensión secundaria), comparando contra tablas de catálogo administradas desde `project-admin` (ver change previo `design-code-generation`, capacidad `design-code-rules-administration`).

Hoy cada fila de esas tres tablas (`design_code_power_letter`, `design_code_primary_tension_letter`, `design_code_secondary_tension_letter`) guarda un único valor de comparación (`powerKva` / `tensionValue`, `decimal(10,2)`), y `DesignCodeGenerationService` hace `Number(row.powerKva) === powerKva` (igualdad exacta) para encontrar la letra (`services/design-code-generation.service.ts`, métodos `findPowerLetter`/`findPrimaryTensionLetter`/`findSecondaryTensionLetter`). Cualquier valor de elemento que no calce exactamente con un valor sembrado hace fallar la generación completa del código con `BadRequestException`, aunque conceptualmente ese valor debería caer dentro del rango de una letra existente.

`project-admin` gestiona estas tablas con UI 100% dirigida por configuración: `DesignCodeRulesPage.tsx` define `fields`/`columns` por tab y los pasa a componentes genéricos (`DesignCodeRuleSection`, `DesignCodeRuleFormModal`, `DesignCodeRuleTable`) que no conocen el dominio "potencia" o "tensión" — solo renderizan campos por `type`. `project-front` no tiene lógica de matching propia: solo consume `segments[].value` ya resuelto por el backend.

Solo `project-front` tiene OpenSpec inicializado; este change documenta el comportamiento esperado en `project-back` y `project-admin`, pero vive como un único change en `project-front`, igual que el change previo `design-code-generation`.

## Goals / Non-Goals

**Goals:**
- Reemplazar la comparación por igualdad exacta por comparación por rango inclusivo (`min <= valor <= max`) en las tres reglas de potencia/tensión.
- Evitar que dos reglas del mismo grupo (misma fase para potencia; todas las filas para cada tabla de tensión) definan rangos que se solapen, para que el resultado de matching sea siempre determinístico.
- Migrar los datos existentes sin cambiar el comportamiento de generación de código el día del deploy (rango degenerado de un solo punto), dejando el ajuste de los rangos reales de negocio como una tarea posterior desde `project-admin`.
- Mantener sin cambios el contrato de `POST /design/code/generate` hacia `project-front` (mismo shape de `segments[].value`), de modo que `project-front` no requiera cambios de código.

**Non-Goals:**
- No se agregan rangos abiertos (sin límite inferior o superior); `min` y `max` son siempre requeridos.
- No se toca `design_code_sap_segment_mapping` ni `design_code_suffix_format` (no son reglas de valor numérico único, están fuera de alcance — ver investigación previa).
- No se resuelve aquí cuáles son los rangos reales de negocio por letra; eso lo carga el equipo desde `project-admin` después del deploy.
- No se cambia el mecanismo de desambiguación de duplicados ni ningún otro segmento del código de diseño.

## Decisions

### 1. Límites inclusivos en ambos extremos (`min <= valor <= max`)
Se elige inclusivo-inclusivo por ser el modelo más simple de razonar para quien carga datos en `project-admin` (un rango "90 a 100" incluye literalmente 90 y 100). Esto obliga a que la validación de solapamiento sea estricta: dos rangos [a,b] y [c,d] del mismo grupo se consideran solapados si `a <= d && c <= b` (incluye el caso de tocarse en un extremo compartido, ej. 90-100 y 100-150 se consideran solapados).

Alternativa descartada: min inclusivo / max exclusivo (`min <= valor < max`, estilo "binning"). Se descartó porque, aunque evita la ambigüedad de solapamiento en los bordes sin necesidad de validación, es menos natural para el caso de uso ("el rango del vatiaje 100 kVA excluye 100" resulta contraintuitivo para quien administra la tabla) y el negocio ya usa el criterio de "no se pueden solapar rangos" como regla explícita, así que la validación de solapamiento es necesaria de todos modos.

### 2. Validación de solapamiento en el backend, por grupo
Al crear o editar una regla de potencia, tensión primaria o tensión secundaria, el service correspondiente (`DesignCodePowerLetterService`, `DesignCodePrimaryTensionLetterService`, `DesignCodeSecondaryTensionLetterService`) consulta las demás filas activas del mismo grupo —mismo `phaseType` para potencia; todas las filas activas de la tabla para cada tensión (cada tabla es su propio grupo, no hay campo de agrupación adicional)— y rechaza la operación con `BadRequestException` si el nuevo rango se solapa con alguna existente (excluyendo la propia fila en un `update`).

Se implementa en el service (no en el controller ni como constraint de BDD) porque ya es el patrón existente: los services de este módulo encapsulan las reglas de negocio de sus entidades (ver `findAll()` con soft-delete), y la validación necesita leer varias filas para decidir, algo que una constraint de columna no puede expresar directamente en SQL Server sin un trigger.

Alternativa descartada: validar solapamiento client-side únicamente (en `project-admin`) — se descarta porque el backend es la única fuente de verdad confiable (evita bypass vía llamadas directas a la API) y porque `DesignCodeGenerationService` depende de que la invariante "sin solapamiento" se cumpla siempre para no tener que resolver ambigüedad en tiempo de generación.

### 3. `DesignCodeGenerationService` toma el primer match como fallback defensivo
Con la validación de solapamiento en su lugar, `findAll().find(row => min <= valor && valor <= max)` debería encontrar como máximo una fila. Si por algún motivo (ej. datos cargados directamente en BDD sin pasar por la validación) hubiera más de un match, se toma el primero que `Array.prototype.find` encuentre (orden de `findAll()`, que ya ordena por `phaseType, powerKva`/`tensionValue` ascendente — se actualiza ese `ORDER BY` para ordenar por la nueva columna `min`). No se agrega una excepción adicional por ambigüedad para no introducir una nueva clase de error en el flujo de generación; la invariante de no-solapamiento es responsabilidad de la capa de escritura.

### 4. Migración de columnas: agregar min/max, backfill, eliminar columna vieja — en una sola migración TypeORM
Para cada una de las tres tablas:
1. Agregar columnas nuevas `power_kva_min`/`power_kva_max` (o `tension_value_min`/`tension_value_max`), mismo tipo `decimal(10,2)`, nullable temporalmente.
2. `UPDATE` backfill: `min = max = <valor de la columna vieja>` para todas las filas existentes (incluidas las soft-deleted, por consistencia).
3. Alterar las columnas nuevas a `NOT NULL`.
4. Eliminar la columna vieja (`power_kva` / `tension_value`).

Esto se hace en una sola migración (no en pasos separados desplegados en releases distintos) porque el volumen de datos es pequeño (≤26 filas por tabla, según el seed actual) y no hay lectores externos de estas tablas fuera de este módulo — no hay necesidad de una migración expand/contract en múltiples deploys.

Alternativa descartada: mantener la columna vieja como derivada (`min`) y solo agregar `max` — se descarta por claridad de nombres; `powerKva` ya no comunicaría su semántica de "límite inferior" sin renombrar.

### 5. DTOs y entidades: `min`/`max` como campos requeridos, con `IsNumber` + validación cruzada
`CreatePowerLetterDto`/`UpdatePowerLetterDto` y `CreateTensionLetterDto`/`UpdateTensionLetterDto` reciben `min`/`max` (nombres de propiedad TypeScript: `powerKvaMin`/`powerKvaMax`, `tensionValueMin`/`tensionValueMax`, consistentes con el nombre de columna en snake_case vía `@Column({ name: ... })`). Se agrega una validación (`@ValidatorConstraint` custom o chequeo manual en el service, a definir en `/opsx:apply`) que rechaza `min > max` antes de intentar la validación de solapamiento, para dar un mensaje de error más claro y específico.

### 6. `project-admin`: dos campos numéricos por tab, validación cruzada en el modal
Cada uno de los tres tabs (`pages/DesignCodeRulesPage.tsx`) cambia su `fields`/`columns` de un campo (`powerKva` o `tensionValue`) a dos (`powerKvaMin`/`powerKvaMax` o `tensionValueMin`/`tensionValueMax`), reutilizando el `type: "number"` ya soportado por `DesignCodeRuleFormModal`. Como hoy no existe validación cruzada entre dos campos del mismo formulario en `DesignCodeRuleFormModal`, se agrega soporte mínimo para una función de validación opcional a nivel de config de sección (ej. `validate?: (values) => string | null`) que se ejecuta antes de invocar `onSubmit`, mostrando el mensaje de error inline si falla. Se elige extender el componente genérico (en vez de duplicar `DesignCodeRuleFormModal` para estos tres tabs) porque el resto de su comportamiento (render por `type`, manejo de estado, submit) sigue siendo válido sin cambios.

### 7. `project-front`: sin cambios de código, solo verificación manual
Confirmado por investigación previa: no hay ninguna referencia a `powerKva`, `tensionValue`, `powerLetter` ni `tensionLetter` en `project-front/src`. El contrato de `POST /design/code/generate` no cambia de forma (`segments[].value` sigue siendo la letra ya resuelta). Este change no incluye tareas de implementación en `project-front`, solo una verificación manual post-deploy de que el flujo de generación de código sigue funcionando con datos reales.

## Risks / Trade-offs

- **[Riesgo] Backfill con `min = max = valor_actual` dejaría rangos degenerados en producción si nadie los ajusta luego desde `project-admin`** → Mitigación: comunicar explícitamente al equipo (fuera de este change) que deben cargar los rangos reales tras el deploy; el sistema sigue funcionando igual que hoy (igualdad exacta, encapsulada como rango de ancho cero) hasta que se ajusten, sin romper nada.
- **[Riesgo] La validación de solapamiento podría rechazar ediciones legítimas si el equipo intenta ajustar rangos en un orden que temporalmente los solapa** (ej. angostar el rango A antes de ensanchar el rango B) → Mitigación: es un trade-off aceptado del modelo "sin solapamiento siempre válido"; el equipo debe ajustar rangos en el orden correcto (angostar primero, luego ensanchar) o mover temporalmente uno de los rangos a un valor no conflictivo. No se implementa una transacción multi-fila para este change.
- **[Riesgo] BREAKING change en las columnas de estas tres tablas** (cualquier consumidor externo directo de la BDD que dependa de `power_kva`/`tension_value` se rompe) → Mitigación: confirmado por investigación previa que solo `DesignCodeGenerationService` y los CRUDs de `project-admin` leen estas tablas; no hay otros consumidores conocidos.
- **[Riesgo] Orden de `findAll()` cambia de columna de sort** (de `powerKva`/`tensionValue` a `powerKvaMin`/`tensionValueMin`) → Mitigación: es un cambio interno sin impacto observable, ya que el matching ya no depende del orden salvo como fallback defensivo (Decisión 3).

## Migration Plan

1. `project-back`: nueva migración TypeORM que agrega `*_min`/`*_max` a las tres tablas, hace backfill (`min = max = valor_actual`), fija `NOT NULL` y elimina la columna vieja; actualizar el seed (`1784086342227-design-code-rules.ts`) para poblar `min`/`max` en vez del valor único (mismo criterio de backfill: `min = max = valor_actual` para no inventar rangos de negocio no confirmados).
2. `project-back`: actualizar entidades, DTOs y `DesignCodeGenerationService` (lógica de matching por rango); agregar validación de solapamiento en los tres services de reglas.
3. `project-admin`: actualizar `types/designCodeRules.types.ts` y la config de `fields`/`columns` de los tres tabs en `DesignCodeRulesPage.tsx`; extender `DesignCodeRuleFormModal` (u otro punto del pipeline de submit) con validación cruzada `min <= max`.
4. Desplegar `project-back` y `project-admin` juntos (el contrato de las tres tablas de reglas cambia en el mismo release; no hay forma de desplegarlos por separado sin romper uno de los dos).
5. `project-front` no requiere despliegue coordinado: su contrato con el backend no cambia. Verificar manualmente después del deploy que la generación de código de diseño sigue funcionando.
6. Rollback: revertir la migración (recrear la columna vieja desde `min`, ya que `min = max` para todas las filas hasta que alguien las edite manualmente; si ya se editaron rangos reales, el rollback perdería esa información y debe comunicarse como riesgo antes de ejecutarlo).

## Open Questions

Sin preguntas abiertas pendientes de confirmación por el usuario — las decisiones de inclusividad de límites, validación de solapamiento, estrategia de migración y alcance de rangos abiertos fueron confirmadas explícitamente antes de escribir este documento. Cualquier detalle de implementación no cubierto aquí (nombres exactos de mensajes de error, forma exacta del mecanismo de validación cruzada en `project-admin`) se resuelve durante `/opsx:apply` sin impacto en el comportamiento especificado.
