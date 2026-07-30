## Context

El módulo de diseño (`project-front`) permite crear un `Design` asociado a uno o más `Element` (`design.designElements[].element`). Cada `Element` tiene un campo `sapReference` (string, columna DB `sap_refence` en `project-back`, `src/modules/element/entities/element.entity.ts`) con segmentos separados por guion, ej.:

```
1-25-220-120-CV-CTY-NTCA-CO-ST
```

El campo `Design.code` (columna existente `nvarchar(max)` en `project-back`, `src/modules/design/entities/design.entity.ts`) hoy se llena en el cliente con un placeholder sin significado (`"DESIGN_" + Date.now()`, en `src/pages/ElementsDesignPage.tsx`, función `handleSaveDesignWithSubDesigns`). El negocio requiere que ese código se calcule siguiendo una nomenclatura técnica (ej. `1DAA26MOAL-CO CV`) derivada de la referencia SAP más un conjunto de tablas de conversión que cambian con el tiempo (potencia→letra, tensión→letra, formatos de sufijo, etc.), por lo que deben vivir como datos configurables en BDD y no como constantes de código.

Existe precedente de parsing de `sapReference` en el propio frontend: `ElementsDesignPage.tsx:320` ya hace `selectedElements[0].sapReference?.split("-")[0]` para derivar la fase y filtrar subtipos — confirma que "elemento principal = primer elemento seleccionado" es un patrón ya aceptado en este flujo, y que dividir por `-` es el mecanismo de parsing esperado.

No existe hoy en `project-back` ningún módulo de catálogo/reglas administrable de forma genérica, ni en `project-admin` ninguna pantalla de administración de reglas de negocio (solo CRUDs de entidades como usuarios). `project-admin` tampoco aplica gating por rol en las rutas — `ProtectedRoute` únicamente valida `isAuthenticated`.

Solo `project-front` tiene OpenSpec inicializado; por eso este change documenta el comportamiento esperado en los tres repos, pero vive como un único change en `project-front`. La implementación real requerirá trabajo coordinado en `project-back`, `project-admin` y `project-front` fuera del ciclo estricto de OpenSpec de este repo.

## Goals / Non-Goals

**Goals:**
- Calcular el código de diseño de forma determinística a partir de `Element.sapReference` y de reglas 100% configurables en BDD (sin constantes hardcodeadas de potencia/tensión/sufijos en el código de aplicación).
- Garantizar unicidad de `Design.code`, con una vía de resolución de colisiones editable por el usuario y basada en una regla de sufijo configurable.
- Permitir administrar (alta/edición/baja) las tablas de reglas desde `project-admin`, incluyendo cuál formato de sufijo de desambiguación es el predeterminado.
- Mantener compatibilidad con el modelo de datos actual: reutilizar `Design.code` y `Element.sapReference` sin romper el esquema existente.

**Non-Goals:**
- No se migran ni recalculan códigos de diseños ya existentes (`Design.code` histórico queda intacto).
- No se implementa un catálogo administrable de valores "MO"/"material de devanado" en `project-admin`: estos valores se leen directamente de celdas etiquetadas dentro de la hoja del propio diseño (ver Decisión 4).
- No se rediseña el módulo de permisos/roles global de `project-admin`; solo se extiende `ProtectedRoute` lo mínimo necesario para restringir las nuevas pantallas a `ADMIN`.
- No se cubren fases distintas a los tres segmentos numéricos observados (1/3/6); el sistema no valida semánticamente el número de fases, solo lo usa como texto literal.

## Decisions

### 1. Motor de generación vive en `project-back`, no en el frontend
El cálculo del código se expone como un endpoint de backend (`POST /design-code/generate` o similar, dentro de un nuevo módulo `design-code-rules`) en lugar de calcularse en `project-front`. Razón: las reglas se administran centralmente desde `project-admin` y deben aplicarse igual sin importar el cliente que genere el diseño; además la verificación de unicidad contra `Design.code` requiere acceso directo a BDD.

Alternativa descartada: calcular en el frontend con las tablas cacheadas localmente — se descarta porque duplicaría lógica de negocio en dos repos y complicaría mantener sincronizadas las reglas.

**Excepción**: los valores de los segmentos "MO" y "material de devanado" (Decisión 4) no pueden resolverse en el backend porque provienen de celdas de un diseño que aún no ha sido guardado (existe solo en el estado en memoria del cliente al momento de generar el código). Por eso el frontend resuelve esos dos valores localmente (leyendo las celdas etiquetadas del `designSheets` actual) y los envía como parte del payload de la solicitud de generación; el backend los trata como valores de entrada, no como algo que resuelve por sí mismo.

### 2. Modelo de datos de reglas: tablas de catálogo simples, no un motor de reglas genérico
Se modelan las reglas como tablas específicas (una por tabla de conversión: potencia, tensión primaria, tensión secundaria, mapeo de segmentos SAP, valores de catálogo MO/material, formatos de sufijo), siguiendo el patrón de catálogos existente (`norm`, `element`), en vez de construir un motor de reglas genérico tipo "regla = expresión". Razón: las tablas del dominio (imagen de reglas proporcionada) son fijas en estructura (letra→valor) y cambian solo en contenido, no en forma; un motor genérico añadiría complejidad sin beneficio.

### 3. Posiciones de segmentos dentro de `sapReference` como regla configurable
En vez de hardcodear "segmento país = índice 7" o "sufijo final = índice 4", se introduce una entidad `DesignCodeSapSegmentMapping` que define, por nombre lógico de segmento (`fase`, `potencia`, `tensionPrimaria`, `tensionSecundaria`, `sufijoFinal`, `paisCode`), qué índice (0-based, tras hacer `split("-")`) de `sapReference` le corresponde. Se crea un registro semilla con los valores por defecto inferidos del ejemplo (`1-25-220-120-CV-CTY-NTCA-CO-ST`): `fase=0, potencia=1, tensionPrimaria=2, tensionSecundaria=3, sufijoFinal=4, paisCode=7`. Razón: el usuario pidió reglas dinámicas en BDD; codificar las posiciones como configuración evita un despliegue si la estructura de la referencia SAP cambia, y resuelve la ambigüedad de la posición real del segmento país (ver Open Questions) sin bloquear el resto del diseño.

### 4. Valores "MO" y "material de devanado" se leen de celdas etiquetadas dentro de la hoja del diseño (confirmado por el usuario)
En vez de un catálogo global administrable, "MO" y "MD" (material de devanado) son **etiquetas que el usuario asigna a una celda específica** del spreadsheet del diseño mediante el menú contextual (click derecho) de celda. Al generar el código, el sistema lee el valor de la celda etiquetada como `MO` y de la celda etiquetada como `MD` dentro de las hojas del diseño en edición, y los usa como esos dos segmentos del código.

**Cómo se integra con el spreadsheet existente** (`src/components/design/`):
- El tipo `Cell` (`src/components/design/spreadsheet-types.ts:3-28`) no tiene hoy ningún campo de etiqueta genérica; se le agrega un campo opcional nuevo, ej. `materialTag?: "MO" | "MD"`, siguiendo el mismo patrón que campos existentes de metadata por celda como `note` o `goTo`.
- El menú contextual de celda ya existe en `SpreadSheet.tsx` (estado `contextMenu` con `type: "cell"`, líneas ~736-743 y ~5798+; handler `handleCellContextMenu`, líneas 1815-1859) y ya resuelve acciones similares (agregar/editar nota, configurar "GoTo") mediante `setSheets((prev) => prev.map(...))`. Se agrega ahí una nueva opción "Etiquetar como MO" / "Etiquetar como Material de Devanado" que setea `materialTag` en la celda seleccionada, siguiendo ese mismo patrón.
- Unicidad de la etiqueta dentro de un diseño: como máximo una celda puede tener `materialTag: "MO"` y como máximo una celda puede tener `materialTag: "MD"` en todo el diseño (puede abarcar varias hojas/`Sheet`). Al etiquetar una nueva celda con una etiqueta ya usada en otra celda del mismo diseño, la etiqueta anterior se quita automáticamente de la celda previa (comportamiento "exclusivo" — decisión de diseño, no confirmada explícitamente por el usuario, ver Riesgos).
- Lectura al generar: en `ElementsDesignPage.tsx`, `handleSaveDesignWithSubDesigns` (o el paso previo de "generar código"), se recorre `designSheets.flatMap(sheet => Object.values(sheet.cells))` buscando la celda con `materialTag === "MO"` y la celda con `materialTag === "MD"`, tomando su `value` (o `computed` si es una fórmula) como los valores a enviar al endpoint de generación. Este es el mismo patrón de lectura usado hoy por `getCellValueFromAnySheet` (`SpreadSheet.tsx:1199-1236`) y por lookups directos como en `InlineCellGraphic.tsx:51`.
- Persistencia: al no requerir una estructura nueva, la etiqueta viaja junto con el resto de la celda dentro de `SubDesignData.data` al guardar el diseño (mismo mecanismo de serialización ya usado para `hiddenCells`, `mergedCells`, etc.), por lo que queda disponible si el diseño se vuelve a abrir para edición.

Alternativa descartada: catálogo global (`DesignCodeCatalogValue`) — se descarta porque el usuario confirmó que el valor debe salir de una celda del propio diseño, no de un valor fijo compartido entre todos los diseños.

### 5. Sufijo de desambiguación como catálogo de formatos con `isDefault`
Se modela `DesignCodeSuffixFormat` con `pattern` (ej. `LETTER_SUFFIX`, `LETTER_SUFFIX_DASH`, `NUMERIC_SUFFIX`, `NUMERIC_SUFFIX_DASH` — correspondientes a `26A`, `26-A`, `261`, `26-1`) y un flag `isDefault` (único activo a la vez). El backend, al detectar colisión, genera una propuesta usando el formato marcado como predeterminado, incrementando la secuencia (letra o número) hasta encontrar un `code` libre; el usuario puede sobreescribir libremente el valor final antes de guardar.

### 6. Elemento usado para la generación: el primero de `designElements`
Cuando un diseño tiene múltiples elementos asociados, se usa `selectedElements[0]` (el primer elemento agregado en el flujo de creación) como fuente de `sapReference`, replicando el criterio ya usado en `ElementsDesignPage.tsx:320` para derivar la fase. Ver Open Questions: esto es una asunción de negocio, no una confirmación explícita del usuario.

### 7. Convención de endpoints y ubicación de código
- `project-back`: nuevo módulo `src/modules/design-code-rules/` (entities, dtos, services, module) registrado en `app.module.ts`, que expone un servicio de generación y los endpoints CRUD de administración de reglas (protegidos con `@Roles(Role.ADMIN)`) en su propio controlador. El endpoint de generación (`POST /design-code/generate` o similar) **vive en `design.controller.ts`** (módulo `design` existente), no en un controlador propio del módulo `design-code-rules` — este último exporta el servicio de generación para que `design.controller.ts` lo inyecte y lo exponga, protegido por los guards globales existentes (confirmado por el usuario).
- `project-admin`: nuevas páginas bajo `src/pages/` (una por tabla de reglas, o una página con tabs — a decidir en implementación) siguiendo el patrón `UsersPage.tsx` + `UserFormModal.tsx` + `useUsers.ts` + `userService.ts` + `user.types.ts`.
- `project-front`: nuevo `src/store/apis/designCodeApi.tsx` (RTK Query) con mutación `generateDesignCode`; `ElementsDesignPage.tsx` la invoca automáticamente (ver Decisión 8) y muestra el código en un panel siempre visible (editable), no en un modal disparado al guardar.

### 8. Generación en vivo con vista previa (placeholder) mientras faltan MO/MD — confirmado por el usuario tras probar el flujo
El código de diseño ya NO se genera solo al presionar "Guardar". En cambio, se genera (y regenera) automáticamente apenas hay un elemento principal disponible (ej. al entrar a `/elements/design?ids=...`, tan pronto `selectedElements[0]` se resuelve), y se recalcula cada vez que cambian las celdas etiquetadas `MO`/`MD` en el diseño. El usuario ve el código evolucionar en tiempo real mientras arma el diseño, en vez de descubrirlo recién al guardar.

Para soportar esto, el endpoint de generación (`POST /design/code/generate`) deja de exigir `moValue`/`materialDevanadoValue`: ambos son opcionales en `GenerateDesignCodeDto`. Cuando falta alguno, el backend arma el código igualmente usando un placeholder (`"??"`) en ese segmento y devuelve `isComplete: false` junto con `moMissing`/`materialDevanadoMissing`, **sin** consultar duplicados ni resolver sufijo de desambiguación (no tiene sentido comparar contra la BDD un código que todavía tiene segmentos placeholder). El frontend muestra ese código parcial junto con un mensaje indicando qué falta etiquetar; en cuanto ambas celdas quedan etiquetadas, la siguiente regeneración ya viene con `isComplete: true` (incluyendo la verificación de duplicados y el sufijo si aplica).

El código generado **no es libremente editable** (ver Decisión 10 — iteración posterior confirmada por el usuario). El botón "Guardar" valida que `isComplete` sea `true` y, si hay duplicado pendiente de resolver, que el sufijo ya haya sido verificado como disponible.

Alternativa descartada: seguir generando solo al guardar (diseño original de este change) — se descartó porque el usuario, al probar el flujo real, encontró que era mejor ver el código —aunque incompleto— desde el principio, ya que la mayoría de los segmentos (fase, potencia, tensiones, año, país, sufijo final) ya están disponibles apenas se conoce el elemento, sin depender de MO/MD.

### 9. Desglose por segmentos en la respuesta del endpoint + UI de "chips" interactivos (confirmado por el usuario, iteración de UI)
El panel de código de diseño se reubicó dentro del contenido del tab "DISEÑO" (antes vivía fuera de los tabs, visible también en "COSTOS", lo cual no correspondía). Además, se rediseñó la presentación: en lugar de mostrar únicamente el string concatenado, la respuesta del endpoint de generación ahora incluye un arreglo `segments` con el desglose semántico de cada parte del código (`FASE`, `POTENCIA`, `TENSION_PRIMARIA`, `TENSION_SECUNDARIA`, `ANIO`, `MO`, `MATERIAL_DEVANADO`, `PAIS`, `SUFIJO_FINAL`), cada uno con `label`, `value` e `isMissing`.

El frontend (`DesignCodePanel.tsx`, nuevo componente) usa este desglose para renderizar cada segmento como un "chip" individual (valor + etiqueta), con estilos diferenciados: gris para segmentos resueltos desde SAP/reglas, violeta para MO/MD resueltos (provienen de celdas etiquetadas por el usuario), ámbar punteado con pulso para MO/MD faltantes (con tooltip indicando qué celda etiquetar). Se incluye una barra de progreso (`resueltos/total`), badge de estado (generando/incompleto/duplicado/completo), botón de copiar al portapapeles, y el código ensamblado completo mostrado de forma prominente en monoespacio debajo de los chips para que el usuario siempre vea el valor final que quedará registrado.

Alternativas consideradas (presentadas al usuario con mockups): (a) tarjeta con checklist en vivo y (b) banner de estado minimalista. Se descartaron a favor de los chips interactivos por pedido explícito del usuario de una UI "interactiva e innovadora".

### 10. Edición restringida al sufijo de desambiguación + verificación en tiempo real (iteración posterior al flujo de duplicado)
Tras revisar el flujo de duplicado con el usuario, se decidió que el código generado **no debe ser libremente editable** en ningún estado. Solo cuando el sistema detecta un duplicado (`isDuplicate: true`) se habilita la edición, y únicamente del sufijo de desambiguación (el token que el backend inserta entre el año y el valor MO). El resto del código permanece fijo y se visualiza a ambos lados del input como contexto no editable.

Cambios concretos en backend:
- El endpoint `POST /design/code/generate` incluye ahora `suffixPattern` en la respuesta cuando `isDuplicate: true`, con el identificador del patrón predeterminado activo (`LETTER_SUFFIX`, `NUMERIC_SUFFIX`, etc.) para que el frontend pueda mostrar al usuario el formato esperado.
- Nuevo endpoint `GET /design/code/is-available?code=XXX` que devuelve `{ isAvailable: boolean }`, usado por el frontend para verificar en tiempo real si el sufijo ingresado por el usuario genera un código disponible, sin necesidad de intentar guardar.

Cambios concretos en frontend (`DesignCodePanel.tsx`):
- El chip del segmento `ANIO` se recalcula en tiempo real mientras el usuario escribe el sufijo (sin llamada al servidor), para que los chips reflejen siempre el código que se va a guardar.
- Se muestra debajo del input el formato esperado del sufijo según `suffixPattern` (ej. "Letra A-Z (ej: A, B, C…)" o "Guion + número (ej: -1, -2…)").
- Flujo de confirmación del sufijo: mientras el usuario edita aparece el botón "Verificar disponibilidad" (que llama a `GET /design/code/is-available`) y el botón "Descartar cambios" (para volver a la sugerencia del backend); al confirmar un sufijo disponible, el badge pasa a "Completo" (verde) y aparece el botón "Cambiar" para re-editar si se desea; si el sufijo también existe, se muestra un aviso inline.
- La sugerencia automática del backend (siempre libre, por construcción del algoritmo) se inicializa como verificada, sin requerir acción adicional del usuario si la acepta tal cual.
- En `ElementsDesignPage.tsx`: se elimina `designCodeManuallyEdited` y `generatedDesignCode`; se introduce `disambiguationToken` (token confirmado), `isDirtyDisambiguation` (flag que bloquea el guardado si el usuario cambió el sufijo sin verificarlo) y `effectiveDesignCode` (memo que reconstruye el código final a partir del token confirmado).

Alternativa descartada: mantener el código completo editable (comportamiento de Decisión 8) — se descartó porque el usuario lo consideró confuso y susceptible a errores tipográficos que corrompieran la nomenclatura; restringir la edición al sufijo mantiene la integridad del código mientras da flexibilidad donde realmente importa.

## Risks / Trade-offs

- **[Riesgo] La posición real del segmento país y del sufijo final podría no ser constante entre referencias SAP reales** (el ejemplo tiene 9 segmentos, pero no se validó contra un dataset real) → Mitigación: modelar las posiciones como configuración (Decisión 3) en vez de hardcodearlas, y validar con el usuario/dataset real antes de fijar los valores semilla en producción.
- **[Riesgo] Ningún diseño garantiza tener una celda etiquetada como `MO` o `MD` al momento de guardar** → Mitigación: el sistema muestra el código en vivo con placeholder (`"??"`) y un mensaje indicando qué falta etiquetar (Decisión 8) mientras se edita el diseño, y bloquea explícitamente el botón "Guardar" (`isComplete === false`) hasta que ambas celdas estén etiquetadas.
- **[Riesgo] El placeholder `"??"` usado en el código de vista previa (Decisión 8) podría coincidir por casualidad con un valor real que alguien escriba en una celda MO/MD** → Mitigación: el placeholder solo se usa cuando el campo falta por completo (no hay celda etiquetada), nunca se compara contra la BDD mientras el código está incompleto, así que una coincidencia casual no genera falsos duplicados; si se vuelve un problema real, se puede cambiar a un token menos común (ej. `"⋯"` o un marcador con caracteres no imprimibles) sin romper el contrato de la API.
- **[Riesgo] El reemplazo automático de etiqueta (Decisión 4, confirmado por el usuario) puede pasar desapercibido** si el usuario etiqueta una celda sin notar que otra perdió la etiqueta → Mitigación: mostrar feedback visual claro (ej. resaltar/desresaltar la celda) en el momento del reemplazo.
- **[Riesgo] Duplicados concurrentes**: dos usuarios podrían generar el mismo código simultáneamente antes de que ninguno haya guardado, causando una colisión en el `INSERT` final aunque la verificación previa haya dicho "libre" → Mitigación: mantener una constraint de unicidad a nivel de BDD sobre `design.code` (si no existe ya) como última línea de defensa, y manejar el error de constraint en el backend devolviendo el mismo flujo de "código duplicado, edítalo" en vez de un error 500 genérico.
- **[Riesgo] BREAKING change en el contrato de creación de diseño** (el cliente deja de poder mandar cualquier `code` libre) → Mitigación: coordinar el despliegue de `project-back` y `project-front` en el mismo ciclo de release; considerar aceptar temporalmente un `code` explícito en el DTO de creación (para no bloquear otros flujos que hoy dependan de setearlo) validando igualmente unicidad.

## Migration Plan

1. `project-back`: crear migraciones TypeORM para las nuevas tablas (`design_code_power_letter`, `design_code_primary_tension_letter`, `design_code_secondary_tension_letter`, `design_code_sap_segment_mapping`, `design_code_suffix_format`) y seeds con los valores por defecto extraídos de la imagen de reglas, el mapeo de posiciones inferido del ejemplo dado por el usuario, y los formatos de sufijo. No se toca la columna `design.code` existente. No hay tabla de catálogo para MO/MD (ver Decisión 4).
2. `project-back`: implementar el módulo `design-code-rules` (servicio de generación + CRUD de administración) detrás de los guards/roles existentes; el endpoint de generación recibe `moValue`/`materialDevanadoValue` como parte del payload en vez de resolverlos internamente.
3. `project-admin`: implementar las pantallas de administración de reglas (potencia, tensiones, mapeo de segmentos SAP, formatos de sufijo — sin pantalla de catálogo MO/MD); extender `ProtectedRoute` con soporte de rol `ADMIN`.
4. `project-front`: agregar el campo `materialTag` al tipo `Cell` y la opción de etiquetado en el menú contextual de celda (`SpreadSheet.tsx`); integrar la llamada de generación en `ElementsDesignPage.tsx` leyendo las celdas etiquetadas de `designSheets`; agregar el paso de UI de confirmación/edición/duplicado.
5. Desplegar `project-back` antes o junto con `project-front` (el backend puede convivir con el placeholder actual del frontend sin romper nada; el frontend sí depende del nuevo endpoint).
6. Rollback: si se detectan problemas, `project-front` puede revertirse a generar el placeholder localmente sin requerir rollback de `project-back` (las tablas nuevas no afectan flujos existentes).

## Decisiones confirmadas por el usuario

Las siguientes preguntas abiertas de una versión anterior de este documento fueron resueltas directamente por el usuario:

- **Posición del segmento país dentro de `sapReference`**: confirmado — se extrae literalmente del segmento de país de la referencia SAP según el mapeo de posiciones configurado (Decisión 3), con el valor semilla inferido del ejemplo dado.
- **Origen de los valores "MO" y "material de devanado"**: confirmado — se leen de celdas del spreadsheet del diseño etiquetadas por el usuario vía menú contextual (click derecho → "Etiquetar celda como MO/MD"), no de un catálogo administrable. Ver Decisión 4.
- **Elemento usado cuando el diseño tiene múltiples elementos**: confirmado — se usa el primer elemento de la lista (`designElements[0]` / `selectedElements[0]`), consistente con el precedente ya existente en `ElementsDesignPage.tsx:320`.
- **Momento de generación**: confirmado — el código se genera y se muestra editable al usuario antes de guardar el diseño.
- **Ubicación del endpoint de generación**: confirmado — vive en `design.controller.ts` (módulo `design` existente), reutilizando el servicio de generación exportado por el módulo `design-code-rules`. Ver Decisión 7.
- **Comportamiento "exclusivo" de la etiqueta MO/MD**: confirmado — etiquetar una nueva celda reemplaza automáticamente la etiqueta previa dentro del mismo diseño (sin bloqueo). Ver Decisión 4.
- **Comportamiento cuando falta una celda etiquetada al generar**: confirmado — el sistema rechaza la generación e indica al usuario, mediante un mensaje, qué etiqueta falta (`MO` y/o `MD`).

## Open Questions

Sin preguntas abiertas pendientes de confirmación por el usuario. Cualquier detalle de implementación no cubierto aquí (ej. nombres exactos de columnas, forma exacta del DTO) se resuelve durante `/opsx:apply` sin impacto en el comportamiento especificado.
