## Why

Hoy el campo `Design.code` (columna existente `code` en la tabla `design`) se llena con un placeholder sin significado de negocio (`"DESIGN_" + Date.now()`, ver `src/pages/ElementsDesignPage.tsx`). El área de ingeniería necesita que ese código se genere automáticamente a partir de la referencia SAP del elemento asociado al diseño (ej. `1-25-220-120-CV-CTY-NTCA-CO-ST`) siguiendo una nomenclatura técnica normalizada (ej. `1DAA26MOAL-CO CV`), para poder identificar y trazar diseños de forma consistente entre elementos, evitar códigos duplicados, y permitir que las tablas de conversión (potencia, tensión, sufijos, etc.) se mantengan y ajusten sin requerir un despliegue de código, ya que estas reglas cambian con cierta frecuencia según normativa interna.

## What Changes

- Se introduce la generación automática del código de diseño en el flujo de creación de un diseño, calculado a partir de la referencia SAP (`Element.sapReference`) del elemento principal del diseño y de un conjunto de reglas de conversión configurables (fase, potencia, tensión primaria, tensión secundaria, año, valores MO/material de devanado, código país, sufijo posicional).
- Se reemplaza el valor placeholder actual (`"DESIGN_" + Date.now()`) por el código generado, mostrado al usuario como propuesta editable antes de guardar el diseño.
- Se añade validación de unicidad: antes de persistir, se verifica si el código propuesto ya existe en `design.code`; si existe, se informa al usuario y se ofrece un sufijo de desambiguación (agregado después del segmento de año) generado según un formato configurable (ej. `26A`, `261`, `26-A`, `26-1`), permitiendo edición manual libre del código final.
- Se introducen tablas de reglas configurables en base de datos (nuevo módulo backend) para: potencia→letra (mono/trifásica), tensión primaria→letra, tensión secundaria→letra, mapeo de posiciones de segmentos dentro de la referencia SAP, y catálogo de formatos de sufijo de desambiguación (con un formato marcado como predeterminado).
- Se añade en `project-front` la posibilidad de etiquetar una celda del spreadsheet del diseño como `MO` o como `MD` (material de devanado) mediante el menú contextual de celda; el valor de esas celdas etiquetadas alimenta esos dos segmentos del código generado (no son un catálogo administrable, sino datos propios de cada diseño).
- Se añade administración de estas tablas de reglas en el proyecto de administración (`project-admin`), incluyendo la capacidad de marcar/cambiar cuál formato de sufijo de desambiguación es el predeterminado.
- **BREAKING**: el contrato de creación de diseño deja de aceptar (o deja de depender de) un `code` arbitrario generado en el cliente; el código pasa a originarse en el backend a partir de una operación de generación explícita.

## Capabilities

### New Capabilities
- `design-code-generation`: cálculo del código de diseño a partir de la referencia SAP del elemento y las reglas configurables, incluyendo la detección de duplicados y la generación de un código alternativo mediante sufijo de desambiguación.
- `design-code-rules-administration`: administración (alta, edición, baja, consulta) de las tablas de reglas configurables que alimentan la generación del código de diseño, incluyendo la selección del formato de sufijo de desambiguación predeterminado.

### Modified Capabilities
(ninguna — no existen specs previas en `openspec/specs/`, el proyecto parte de cero en OpenSpec)

## Impact

- **project-back**: nuevo módulo `design-code-rules` (entidades, DTOs, servicio, controlador) siguiendo el patrón de `src/modules/design`, `src/modules/element`, `src/modules/norm`; nuevo endpoint de generación de código que lee `Element.sapReference` (`src/modules/element/entities/element.entity.ts`, columna DB `sap_refence`) y compara contra `Design.code` (`src/modules/design/entities/design.entity.ts`); endpoints de administración protegidos con `@Roles(Role.ADMIN)` (`src/modules/auth/decorators/roles.decorator.ts`); nuevas migraciones TypeORM.
- **project-admin**: nuevas pantallas CRUD para cada tabla de reglas, replicando el patrón de `UsersPage.tsx` / `UserFormModal.tsx` / `useUsers.ts` / `userService.ts` / `user.types.ts`; requiere extender `ProtectedRoute` (hoy solo valida `isAuthenticated`) para restringir estas pantallas a rol `ADMIN`.
- **project-front**: cambio en `src/pages/ElementsDesignPage.tsx` (función `handleSaveDesignWithSubDesigns`) para invocar la generación de código en vez de usar el placeholder; nuevo componente/flujo de UI para mostrar el código propuesto, permitir edición y mostrar el mensaje de duplicado; reutiliza tipos existentes `Design.code`, `ElementResponse.sapReference` en `src/commons/types.ts`; nuevos endpoints en `src/store/apis/designApi.tsx` (o un nuevo `designCodeApi.tsx`).
- **BDD**: nuevas tablas de catálogo/reglas en project-back; sin cambios de esquema en `design.code` (columna ya existente, se reutiliza).
