## Why

Hoy las reglas de conversión potencia→letra, tensión primaria→letra y tensión secundaria→letra (módulo `design-code-rules`) comparan el valor del elemento contra un único valor estático por fila (igualdad exacta). Cualquier valor que no calce exactamente con un valor sembrado hace fallar la generación del código de diseño (`BadRequestException`), aunque el valor esté claramente dentro del rango que le correspondería a una letra según la normativa interna. El equipo necesita poder definir, para cada letra, un rango de valores válidos (mínimo y máximo) en vez de un único punto, para reflejar cómo se agrupan realmente las potencias y tensiones por letra y evitar fallos de generación por valores intermedios legítimos.

## What Changes

- **BREAKING**: se reemplaza el campo único `powerKva` (en `design_code_power_letter`) por `powerKvaMin`/`powerKvaMax`, y el campo único `tensionValue` (en `design_code_primary_tension_letter` y `design_code_secondary_tension_letter`) por `tensionValueMin`/`tensionValueMax`. Las filas existentes se migran con `min = max = valor_actual` (comportamiento de generación de código sin cambios el día del deploy); el ajuste de los rangos reales de negocio se hace después, manualmente, desde `project-admin`.
- El matching en `DesignCodeGenerationService` (`findPowerLetter`, `findPrimaryTensionLetter`, `findSecondaryTensionLetter`) pasa de igualdad exacta (`valor === powerKva`) a pertenencia a rango inclusivo (`min <= valor <= max`). Se mantiene el mismo error (`BadRequestException`) cuando ningún rango contiene el valor.
- Se agrega validación de solapamiento de rangos al crear o editar una regla de potencia, tensión primaria o tensión secundaria: se rechaza (400) si el rango nuevo se cruza con el de otra regla activa del mismo grupo (misma `phaseType` para potencia; todas las filas activas para cada tabla de tensión, ya que cada tabla es su propio grupo).
- Se actualizan los DTOs de creación/edición de estas tres reglas (`CreatePowerLetterDto`/`UpdatePowerLetterDto`, `CreateTensionLetterDto`/`UpdateTensionLetterDto`) para recibir `min`/`max` en vez de un valor único, con validación `min <= max`.
- Se actualiza la administración en `project-admin` (`DesignCodeRulesPage.tsx` y tipos asociados) para que cada uno de los tres tabs (potencia, tensión primaria, tensión secundaria) muestre y edite dos campos numéricos (mínimo/máximo) en vez de uno, tanto en la tabla como en el formulario, incluyendo validación de "mínimo no puede ser mayor que máximo" antes de enviar.
- `project-front` no requiere cambios de código: solo consume `segments[].value` ya resuelto por el backend y no tiene lógica de matching propia; se valida manualmente después del despliegue que la generación de código sigue funcionando igual.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `design-code-generation`: la resolución de la letra de potencia/tensión pasa de comparar por igualdad exacta a comparar por pertenencia a un rango [min, max] inclusivo.
- `design-code-rules-administration`: las reglas de potencia, tensión primaria y tensión secundaria pasan de tener un único valor de comparación a tener un rango (mínimo y máximo), con validación de solapamiento entre reglas del mismo grupo.

## Impact

- **project-back**: entidades `DesignCodePowerLetter`, `DesignCodePrimaryTensionLetter`, `DesignCodeSecondaryTensionLetter` (`src/modules/design-code-rules/entities/`); DTOs `power-letter.dto.ts`, `tension-letter.dto.ts`; lógica de matching en `services/design-code-generation.service.ts` (`findPowerLetter`, `findPrimaryTensionLetter`, `findSecondaryTensionLetter`); nueva validación de solapamiento en `design-code-power-letter.service.ts`, `design-code-primary-tension-letter.service.ts`, `design-code-secondary-tension-letter.service.ts`; nueva migración TypeORM que agrega columnas `*_min`/`*_max`, hace backfill y elimina la columna vieja; actualización del seed `1784086342227-design-code-rules.ts`.
- **project-admin**: `types/designCodeRules.types.ts` (interfaces con min/max), `pages/DesignCodeRulesPage.tsx` (config de `fields`/`columns` por tab con dos campos numéricos), posible extensión de `components/DesignCodeRuleFormModal.tsx` para soportar validación cruzada entre dos campos (mínimo ≤ máximo) si no existe ya un mecanismo reutilizable.
- **project-front**: sin cambios de código esperados; se verifica manualmente tras el despliegue backend que el flujo de generación de código de diseño sigue funcionando (mismo contrato de respuesta `segments[].value`).
- **BDD**: nueva migración sobre `design_code_power_letter`, `design_code_primary_tension_letter`, `design_code_secondary_tension_letter` (agrega columnas min/max, elimina columna de valor único); sin cambios en `design_code_sap_segment_mapping` ni `design_code_suffix_format`.
