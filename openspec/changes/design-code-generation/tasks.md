## 1. project-back — Modelo de datos de reglas

- [x] 1.1 Crear entidades TypeORM en `src/modules/design-code-rules/entities/`: `design-code-power-letter.entity.ts` (fase, potencia, letra), `design-code-primary-tension-letter.entity.ts`, `design-code-secondary-tension-letter.entity.ts`, `design-code-sap-segment-mapping.entity.ts` (nombre lógico del segmento, índice), `design-code-suffix-format.entity.ts` (patrón, `isDefault`)
- [x] 1.2 Crear migraciones TypeORM para cada tabla nueva (siguiendo el patrón de `src/db/migrations/*.ts`)
- [x] 1.3 Crear seeds (`src/db/seeds/`) con los valores por defecto de las tablas 1.2/1.3/1.4 de la imagen de reglas, el mapeo de posiciones inferido del ejemplo (`fase=0, potencia=1, tensionPrimaria=2, tensionSecundaria=3, sufijoFinal=4, paisCode=7`), y los 4 formatos de sufijo (`26A`, `26-A`, `261`, `26-1`) con uno marcado `isDefault`
- [ ] 1.4 (Opcional según Decisión 7 / Riesgo BREAKING) Evaluar agregar constraint de unicidad a nivel de BDD sobre `design.code` si no existe

## 2. project-back — Motor de generación y endpoints

- [x] 2.1 Crear módulo `src/modules/design-code-rules/design-code-rules.module.ts` y registrarlo en `app.module.ts`; exportar su servicio de generación para que `design.module.ts` pueda inyectarlo
- [x] 2.2 Implementar servicio de generación (`design-code-generation.service.ts`, dentro de `design-code-rules`): parseo de `Element.sapReference` por `-`, resolución de letras de potencia/tensión, resolución de segmentos país/final vía el mapeo configurado, ensamblado del código según el orden definido en `design.md` Decisión 1 / spec `design-code-generation`, usando `moValue`/`materialDevanadoValue` recibidos en el request (no resueltos internamente, ver Decisión 4)
- [x] 2.3 Implementar verificación de unicidad contra `Design.code` y generación de sufijo de desambiguación usando el formato `isDefault` (letra o número, con o sin guion), con incremento hasta encontrar un código libre — **solo aplica cuando el código está completo** (ver 2.4)
- [x] 2.4 Exponer el endpoint de generación (`POST /design/code/generate` recibiendo `elementId`, `moValue`, `materialDevanadoValue`) **en `design.controller.ts`**, inyectando el servicio de generación de `design-code-rules`; protegido por los guards globales existentes. **Actualizado (Decisión 8, tras probar el flujo real con el usuario)**: `moValue`/`materialDevanadoValue` ahora son opcionales — si faltan, el endpoint responde con un código de vista previa usando placeholder `"??"` en el segmento faltante y `isComplete: false` / `moMissing` / `materialDevanadoMissing`, sin consultar duplicados; solo hace la verificación de unicidad y resolución de sufijo (2.3) cuando ambos valores están presentes
- [x] 2.5 Implementar controlador y DTOs CRUD para cada tabla de reglas (potencia, tensión primaria, tensión secundaria, mapeo de segmentos, formatos de sufijo) **dentro del propio módulo `design-code-rules`**, protegidos con `@Roles(Role.ADMIN)`
- [x] 2.6 Manejar errores de reglas faltantes (potencia/tensión sin letra configurada, referencia SAP con menos segmentos de los esperados) con mensajes claros para el frontend
- [x] 2.7 Escribir tests unitarios del servicio de generación cubriendo los escenarios de la spec `design-code-generation` (incluyendo el ejemplo `1-25-220-120-CV-CTY-NTCA-CO-ST` → `1DAA26MOAL-CO CV`)
- [x] 2.8 **(Nuevo, Decisión 9 de `design.md`)** Agregar `segments: DesignCodeSegmentDto[]` a `DesignCodeGenerationResponseDto` con el desglose de los 9 segmentos (`FASE`, `POTENCIA`, `TENSION_PRIMARIA`, `TENSION_SECUNDARIA`, `ANIO`, `MO`, `MATERIAL_DEVANADO`, `PAIS`, `SUFIJO_FINAL`), cada uno con `label`, `value` e `isMissing`; construido en `design-code-generation.service.ts` para los tres casos de retorno (vista previa, completo sin duplicado, completo con sufijo de desambiguación); tests actualizados para verificar el desglose en cada caso
- [x] 2.9 **(Nuevo, Decisión 10 de `design.md`)** Agregar campo `suffixPattern?: string` a `DesignCodeGenerationResponseDto` e `GeneratedDesignCode` interface; incluir el patrón del formato predeterminado en la respuesta cuando `isDuplicate: true`, para que el frontend pueda mostrar al usuario el formato esperado del sufijo
- [x] 2.10 **(Nuevo, Decisión 10 de `design.md`)** Agregar método `isCodeAvailable(code: string): Promise<boolean>` a `DesignCodeGenerationService` y exposición como endpoint `GET /design/code/is-available?code=XXX` en `design.controller.ts`, protegido con `@Roles(Role.ADMIN, Role.DESIGN)`

## 3. project-admin — Administración de reglas

- [x] 3.1 Extender `ProtectedRoute` para aceptar restricción por rol y bloquear acceso a usuarios sin `ADMIN`
- [x] 3.2 Crear `src/types/designCodeRules.types.ts` con los tipos de cada tabla de reglas
- [x] 3.3 Crear `src/services/designCodeRulesService.ts` con los métodos CRUD contra los endpoints de `project-back`
- [x] 3.4 Crear hooks React Query (patrón `useUsers.ts`) para las 5 tablas de reglas — implementado como `src/hooks/useDesignCodeRules.ts` con una factory `createRuleResourceHooks` instanciada una vez por tabla, en vez de 4-5 archivos separados, para no duplicar la misma lógica de query/mutation 5 veces
- [x] 3.5 Crear páginas de administración (`src/pages/DesignCodeRulesPage.tsx` con tabs) con tabla + `FormModal` de alta/edición, mediante componentes reutilizables `DesignCodeRuleSection.tsx`/`DesignCodeRuleTable.tsx`/`DesignCodeRuleFormModal.tsx` (equivalente genérico al patrón `UsersPage.tsx`/`UserFormModal.tsx`, dado que las 5 tablas comparten la misma forma CRUD)
- [x] 3.6 Implementar UI para marcar/cambiar el formato de sufijo predeterminado (selección exclusiva, con confirmación) — acción "Marcar como predeterminado" en la tabla de formatos de sufijo, con modal de confirmación
- [x] 3.7 Agregar el nuevo módulo al menú de navegación, restringido a `ADMIN`

## 4. project-front — Etiquetado de celdas MO/MD

- [x] 4.1 Agregar el campo opcional `materialTag?: "MO" | "MD"` al tipo `Cell` en `src/components/design/spreadsheet-types.ts`
- [x] 4.2 En `SpreadSheet.tsx`, agregar al menú contextual de celda (`contextMenu.type === "cell"`, junto a las opciones de nota/GoTo) las opciones "Etiquetar como MO" y "Etiquetar como Material de Devanado", que actualizan `sheet.cells[cellRef].materialTag` vía `setSheets`
- [x] 4.3 Implementar el comportamiento exclusivo: al asignar una etiqueta, quitarla de cualquier otra celda del diseño que ya la tuviera (recorrer todas las hojas del diseño en edición) — `tagCellAsMaterial` en `SpreadSheet.tsx`
- [x] 4.4 Agregar indicador visual en la celda etiquetada (badge "MO"/"MD" en la esquina superior izquierda) en `SpreadSheetCell.tsx`, para que el reemplazo de etiqueta sea visible para el usuario
- [x] 4.5 Implementar función de extracción `extractMaterialTagValues` en `src/components/design/materialTagUtils.ts` que recorre las hojas del diseño y devuelve el valor de la celda etiquetada `MO` y de la etiquetada `MD`

## 5. project-front — Integración en el flujo de creación de diseño

- [x] 5.1 Crear `src/store/apis/designCodeApi.tsx` (RTK Query) con la mutación `generateDesignCode`, registrada en `src/store/index.tsx`
- [x] 5.2 **(Revisado tras probar el flujo real, ver Decisión 8 de `design.md`)** En `ElementsDesignPage.tsx`, la generación ya NO ocurre al presionar "Guardar": un `useEffect` dispara `generateDesignCode` automáticamente apenas hay un elemento principal (`selectedElements[0]`) y cada vez que cambian los valores `MO`/`MD` extraídos (`taggedMoValue`/`taggedMdValue`); `moValue`/`materialDevanadoValue` ahora son opcionales en el request (el backend soporta generación parcial, ver sección 1). `handleSaveDesignWithSubDesigns` solo valida `designCodePreview?.isComplete` antes de reemplazar `code: "DESIGN_" + Date.now()` por el código ya generado en `generatedDesignCode`
- [x] 5.3 Agregar UI persistente (no modal) que muestre el código en vivo, editable en todo momento; muestra mensaje de qué falta etiquetar mientras `isComplete` es `false`, y mensaje de duplicado con el código base cuando `isDuplicate` es `true` — **superado por 5.6/5.7** (ver más abajo, iteración de UI tras feedback del usuario)
- [x] 5.4 Validar en el cliente que el código final no quede vacío y que `isComplete` sea `true` antes de permitir guardar (dentro de `handleSaveDesignWithSubDesigns`)
- [x] 5.5 Verificado: `DesignViewer.tsx` y `DesignCard.tsx` siguen mostrando `design.code` correctamente sin cambios adicionales (ya leen el campo existente)
- [x] 5.6 **(Nuevo, feedback de usuario tras probar el flujo)** Mover el panel del código de diseño de fuera de los tabs hacia dentro del contenido del tab "DISEÑO" (ya no aparece en "COSTOS")
- [x] 5.7 **(Nuevo, Decisión 9 de `design.md`)** Reemplazar el panel de texto plano por `src/components/design/DesignCodePanel.tsx`: renderiza cada segmento del desglose (`preview.segments`) como un chip individual (valor + etiqueta), con estilo distintivo para segmentos `MO`/`MD` (violeta si están resueltos, ámbar punteado con animación y tooltip si faltan), barra de progreso de segmentos resueltos, badge de estado (generando/completo/incompleto/duplicado) y botón de copiar al portapapeles
- [x] 5.8 **(Nuevo, Decisión 10 de `design.md`)** Eliminar edición libre del código completo; restringir edición únicamente al sufijo de desambiguación cuando `isDuplicate: true`: split-input con prefijo fijo / token editable / resto fijo; eliminar `designCodeManuallyEdited` y `generatedDesignCode` de `ElementsDesignPage.tsx`; introducir `disambiguationToken`, `isDirtyDisambiguation` y memo `effectiveDesignCode`; el save handler bloquea si `isDirtyDisambiguation` es `true`
- [x] 5.9 **(Nuevo, Decisión 10 de `design.md`)** Implementar flujo de verificación de sufijo en `DesignCodePanel.tsx`: botón "Verificar disponibilidad" llama a `GET /design/code/is-available` (nuevo hook `useLazyCheckCodeAvailableQuery`); muestra resultado inline (disponible/tomado); chip de `ANIO` se actualiza en tiempo real con el token en edición; hint del formato esperado según `suffixPattern`; botón "Descartar cambios" y botón "Cambiar" post-confirmación; badge "Completo" cuando el token está verificado; código completo ensamblado mostrado prominentemente debajo de los chips

**Nota de implementación**: el llamado real a `saveDesignWithSubDesigns`/`updateDesign` en `handleSaveDesignWithSubDesigns` sigue comentado (`console.log` en su lugar), tal como ya estaba en el código antes de este change — no se reactivó porque no forma parte del alcance de este change y podría ser un WIP intencional de otra persona. Confirmar con el equipo si debe reactivarse como parte de esta integración.

## 6. Validación cruzada

- [ ] 6.1 Probar el flujo end-to-end: crear un elemento con referencia SAP `1-25-220-120-CV-CTY-NTCA-CO-ST`, etiquetar celdas `MO`/`MD` con valores `MO`/`AL`, generar un diseño y confirmar que el código resultante es `1DAA26MOAL-CO CV`
- [ ] 6.2 Probar el flujo de duplicado: generar dos diseños que produzcan el mismo código base y confirmar que el segundo recibe el aviso y el sufijo alternativo según el formato predeterminado
- [ ] 6.3 Probar que cambiar una regla desde `project-admin` (ej. una letra de tensión o el formato de sufijo predeterminado) afecta la siguiente generación sin requerir despliegue
- [ ] 6.4 Probar el re-etiquetado exclusivo: etiquetar una celda como `MO`, luego etiquetar otra celda como `MO` en el mismo diseño, y confirmar que la primera pierde la etiqueta
- [ ] 6.5 Probar el bloqueo por falta de etiqueta: intentar generar el código sin haber etiquetado `MO` o `MD` y confirmar que el sistema lo rechaza con un mensaje claro
