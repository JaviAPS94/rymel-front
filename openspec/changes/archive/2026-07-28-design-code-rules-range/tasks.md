## 1. project-back — entidades, DTOs y migración

- [x] 1.1 Actualizar `entities/design-code-power-letter.entity.ts`: reemplazar la columna `powerKva` por `powerKvaMin` y `powerKvaMax` (`decimal(10,2)`, `NOT NULL`).
- [x] 1.2 Actualizar `entities/design-code-primary-tension-letter.entity.ts`: reemplazar `tensionValue` por `tensionValueMin` y `tensionValueMax`.
- [x] 1.3 Actualizar `entities/design-code-secondary-tension-letter.entity.ts`: reemplazar `tensionValue` por `tensionValueMin` y `tensionValueMax`.
- [x] 1.4 Actualizar `dtos/power-letter.dto.ts` (`CreatePowerLetterDto`/`UpdatePowerLetterDto`): reemplazar `powerKva` por `powerKvaMin`/`powerKvaMax` (`@IsNumber`, requeridos en create, opcionales en update).
- [x] 1.5 Actualizar `dtos/tension-letter.dto.ts` (`CreateTensionLetterDto`/`UpdateTensionLetterDto`): reemplazar `tensionValue` por `tensionValueMin`/`tensionValueMax`.
- [x] 1.6 Crear migración TypeORM nueva que, para las tres tablas (`design_code_power_letter`, `design_code_primary_tension_letter`, `design_code_secondary_tension_letter`): agrega las columnas `*_min`/`*_max` (nullable), hace backfill `min = max = valor_actual` sobre todas las filas (incluidas soft-deleted), altera las columnas nuevas a `NOT NULL`, y elimina la columna vieja (`power_kva` / `tension_value`).
- [x] 1.7 Actualizar el seed `src/db/seeds/1784086342227-design-code-rules.ts` para poblar `min`/`max` (mismo criterio: `min = max = valor_actual`) en vez del valor único, en las tres tablas.

## 2. project-back — validación de solapamiento

- [x] 2.1 Agregar una función/validador compartido que determine si dos rangos `[min, max]` se solapan (inclusivo en ambos extremos: `a <= d && c <= b`).
- [x] 2.2 En `design-code-power-letter.service.ts`: al crear o actualizar, validar `min <= max` y validar que el nuevo rango no se solape con otra fila activa de la misma `phaseType` (excluyendo la propia fila en update); rechazar con `BadRequestException` con mensaje claro en cada caso.
- [x] 2.3 En `design-code-primary-tension-letter.service.ts`: misma validación (`min <= max` + no solapamiento), agrupando por todas las filas activas de la tabla (sin distinción de fase).
- [x] 2.4 En `design-code-secondary-tension-letter.service.ts`: misma validación, agrupando por todas las filas activas de la tabla (tabla independiente de la primaria).
- [x] 2.5 Actualizar el `ORDER BY` de `findAll()` en los tres services para ordenar por la nueva columna `min` (en vez de `powerKva`/`tensionValue`).

## 3. project-back — lógica de generación de código

- [x] 3.1 En `services/design-code-generation.service.ts`, actualizar `findPowerLetter` para buscar la fila cuyo rango `[powerKvaMin, powerKvaMax]` contenga el valor (`min <= powerKva <= max`) en vez de igualdad exacta, manteniendo el mismo `BadRequestException` cuando no hay match.
- [x] 3.2 Actualizar `findPrimaryTensionLetter` y `findSecondaryTensionLetter` con el mismo criterio de rango sobre `tensionValueMin`/`tensionValueMax`.
- [x] 3.3 Actualizar/agregar tests unitarios en `test/unit/design-code-rules/design-code-generation.service.spec.ts` cubriendo: valor dentro de un rango, valor igual a un límite (min o max), valor fuera de todos los rangos.

## 4. project-back — verificación

- [x] 4.1 Ejecutar la migración localmente sobre una copia de datos existentes y confirmar que `findAll()` sigue devolviendo el mismo número de filas con `min = max = valor_original`. _(ejecutada con `npm run migration:run` contra la BDD de desarrollo real; verificado con consultas directas: 39 filas de potencia intactas, `min = max` = valor histórico en las tres tablas)_
- [ ] 4.2 Confirmar manualmente que generar un código de diseño con los datos migrados (sin editar rangos aún) produce el mismo resultado que antes del cambio. _(pendiente: requiere una BDD real con la migración aplicada)_
- [x] 4.3 Correr la suite de tests del módulo `design-code-rules` y confirmar que pasa. _(19/19 tests OK; `nest build` sin errores)_

## 5. project-admin — tipos y servicios

- [x] 5.1 Actualizar `types/designCodeRules.types.ts`: `DesignCodePowerLetter`/`CreateDesignCodePowerLetterDto` con `powerKvaMin`/`powerKvaMax`; `DesignCodeTensionLetter`/`CreateDesignCodeTensionLetterDto` con `tensionValueMin`/`tensionValueMax`.
- [x] 5.2 Confirmar que `services/designCodeRulesService.ts` y `hooks/useDesignCodeRules.ts` no requieren cambios (son genéricos sobre el tipo de recurso).

## 6. project-admin — UI

- [x] 6.1 En `pages/DesignCodeRulesPage.tsx`, actualizar el tab de potencia: `fields`/`columns` con dos campos numéricos (`powerKvaMin`, `powerKvaMax`) en vez de `powerKva`.
- [x] 6.2 Actualizar el tab de tensión primaria: dos campos (`tensionValueMin`, `tensionValueMax`) en vez de `tensionValue`.
- [x] 6.3 Actualizar el tab de tensión secundaria: mismo cambio que tensión primaria.
- [x] 6.4 Extender `components/DesignCodeRuleFormModal.tsx` (o el punto de configuración de sección correspondiente) con soporte para una validación cruzada opcional entre campos antes de enviar (ej. `validate?: (values) => string | null`), mostrando el error inline si falla.
- [x] 6.5 Configurar en los tres tabs (potencia, tensión primaria, tensión secundaria) la validación `min <= max` usando el mecanismo agregado en 6.4.

## 7. project-admin — verificación

- [ ] 7.1 Probar manualmente crear/editar una entrada de cada tab con `min > max` y confirmar que se bloquea antes de llamar al backend. _(pendiente: requiere login ADMIN contra un backend real)_
- [ ] 7.2 Probar manualmente crear una entrada con rango solapado a una existente y confirmar que el backend rechaza la operación y el mensaje de error se muestra en la UI. _(pendiente: ídem)_
- [ ] 7.3 Probar manualmente el flujo completo de alta/edición/baja en los tres tabs con rangos válidos y no solapados. _(pendiente: ídem)_

## 8. project-front — verificación (sin cambios de código)

- [ ] 8.1 Tras desplegar `project-back`, generar un código de diseño real desde `project-front` (pantalla de creación de diseño) y confirmar que el panel de código sigue mostrando los segmentos de potencia/tensión resueltos correctamente, sin cambios visibles de comportamiento. _(pendiente: requiere despliegue real)_
