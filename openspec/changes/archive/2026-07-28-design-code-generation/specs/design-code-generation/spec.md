## ADDED Requirements

### Requirement: Cálculo del código de diseño a partir de la referencia SAP
El sistema SHALL calcular un código de diseño propuesto a partir de la referencia SAP (`Element.sapReference`) del elemento principal asociado al diseño, combinando: el segmento de fase, una letra de potencia, una letra de tensión primaria, una letra de tensión secundaria, los dos últimos dígitos del año en curso, el valor de catálogo "MO", el valor de catálogo de material de devanado, un guion literal, el código de país extraído de la referencia SAP, un espacio literal y el segmento final extraído de la referencia SAP, en ese orden.

#### Scenario: Generación exitosa a partir de un elemento con referencia SAP válida
- **WHEN** se solicita generar el código de diseño para un elemento cuyo `sapReference` es `1-25-220-120-CV-CTY-NTCA-CO-ST`, con las tablas de reglas configuradas con los valores por defecto y el año actual siendo 2026
- **THEN** el sistema devuelve el código propuesto `1DAA26MOAL-CO CV`

#### Scenario: Elemento principal cuando el diseño tiene varios elementos asociados
- **WHEN** se solicita generar el código de diseño para un diseño con más de un elemento seleccionado
- **THEN** el sistema usa la referencia SAP del primer elemento de la lista como fuente para el cálculo

### Requirement: Letra de potencia según fase y valor de potencia
El sistema SHALL resolver la letra de potencia consultando la tabla de conversión configurable correspondiente (monofásica o trifásica, según el segmento de fase de la referencia SAP) usando el segmento de potencia de la referencia SAP como clave de búsqueda.

#### Scenario: Potencia encontrada en la tabla configurada
- **WHEN** el segmento de fase es `1` (monofásico) y el segmento de potencia es `25`
- **THEN** el sistema resuelve la letra configurada para potencia `25` en la tabla monofásica

#### Scenario: Potencia no encontrada en ninguna tabla
- **WHEN** el segmento de potencia de la referencia SAP no coincide con ningún valor configurado en la tabla correspondiente a la fase indicada
- **THEN** el sistema rechaza la generación e informa que falta una regla de potencia configurada para ese valor

### Requirement: Letras de tensión primaria y secundaria
El sistema SHALL resolver la letra de tensión primaria y la letra de tensión secundaria consultando, respectivamente, las tablas de conversión configurables de tensión primaria y tensión secundaria, usando los segmentos correspondientes de la referencia SAP como clave de búsqueda.

#### Scenario: Tensiones encontradas en las tablas configuradas
- **WHEN** el segmento de tensión primaria de la referencia SAP es `220` y el segmento de tensión secundaria es `120`
- **THEN** el sistema resuelve la letra configurada para `220` en la tabla de tensión primaria y la letra configurada para `120` en la tabla de tensión secundaria

#### Scenario: Tensión no encontrada en la tabla configurada
- **WHEN** un segmento de tensión de la referencia SAP no coincide con ningún valor configurado en la tabla correspondiente
- **THEN** el sistema rechaza la generación e informa que falta una regla de tensión configurada para ese valor

### Requirement: Segmento de año dinámico
El sistema SHALL incluir en el código generado los dos últimos dígitos del año calendario vigente en el momento de la generación, sin depender de la referencia SAP.

#### Scenario: Año calculado al momento de la generación
- **WHEN** se genera un código de diseño durante el año 2026
- **THEN** el segmento de año del código generado es `26`

### Requirement: Etiquetado de celdas como origen de los segmentos MO y material de devanado
El sistema SHALL permitir al usuario etiquetar, mediante el menú contextual de una celda del spreadsheet del diseño, una celda como `MO` y una celda como `MD` (material de devanado), y SHALL usar el valor de la celda etiquetada como `MO` y el valor de la celda etiquetada como `MD` como los segmentos correspondientes al generar el código de diseño. Dentro de un mismo diseño, SHALL existir como máximo una celda etiquetada `MO` y como máximo una celda etiquetada `MD`; etiquetar una nueva celda con una etiqueta ya asignada SHALL quitar la etiqueta de la celda que la tenía previamente.

#### Scenario: Generación usando los valores de las celdas etiquetadas
- **WHEN** el usuario etiquetó una celda con el valor `MO` como `MO` y una celda con el valor `AL` como `MD`, y solicita generar el código de diseño
- **THEN** el código generado incluye `MO` y `AL` en las posiciones correspondientes

#### Scenario: Re-etiquetado exclusivo dentro del mismo diseño
- **WHEN** el usuario etiqueta una nueva celda como `MO` mientras otra celda del mismo diseño ya tenía esa etiqueta
- **THEN** el sistema quita la etiqueta `MO` de la celda anterior y la deja únicamente en la celda recién etiquetada

#### Scenario: Falta una celda etiquetada al generar
- **WHEN** se solicita generar el código de diseño sin haber etiquetado ninguna celda como `MO`, o sin haber etiquetado ninguna como `MD`
- **THEN** el sistema NO rechaza la generación: devuelve un código de vista previa con un placeholder en el segmento faltante e indica cuál de las dos etiquetas falta (ver Requirement "Vista previa del código mientras faltan segmentos MO/MD")

### Requirement: Vista previa del código mientras faltan segmentos MO/MD
El sistema SHALL generar y mostrar un código de diseño de vista previa tan pronto se conozca el elemento principal del diseño, sin esperar a que el usuario haya etiquetado las celdas `MO`/`MD`, y SHALL recalcularlo automáticamente cada vez que cambien los valores de las celdas etiquetadas. Mientras falte `MO` y/o `MD`, el sistema SHALL usar un valor de relleno (placeholder) en el segmento correspondiente en lugar de rechazar la generación, y SHALL indicar explícitamente qué etiqueta(s) faltan. Un código de vista previa (incompleto) NO SHALL compararse contra los códigos de diseño existentes ni recibir un sufijo de desambiguación.

#### Scenario: Vista previa al cargar la pantalla de diseño
- **WHEN** el usuario entra a la pantalla de creación de diseño con un elemento ya seleccionado y ninguna celda etiquetada como `MO` ni `MD`
- **THEN** el sistema muestra de inmediato un código de vista previa (ej. `1DAA26????-CO CV`) junto con un mensaje indicando que faltan etiquetar celdas `MO` y `MD`

#### Scenario: La vista previa se completa automáticamente al etiquetar las celdas
- **WHEN** el usuario etiqueta una celda como `MO` y luego una celda como `MD` mientras ya estaba viendo un código de vista previa incompleto
- **THEN** el sistema recalcula el código automáticamente sin acción adicional del usuario, mostrando el código completo (incluyendo la verificación de duplicados)

### Requirement: Desglose por segmentos del código generado
El sistema SHALL devolver, junto con el código de diseño generado, un desglose de cada segmento semántico que lo compone (fase, potencia, tensión primaria, tensión secundaria, año, MO, material de devanado, país, sufijo final), indicando para cada uno su etiqueta legible, su valor actual y si corresponde a un segmento faltante (vista previa incompleta).

#### Scenario: Desglose de un código completo
- **WHEN** se genera un código completo (con `MO` y `MD` presentes)
- **THEN** el desglose devuelto contiene los nueve segmentos, ninguno marcado como faltante

#### Scenario: Desglose de un código de vista previa incompleto
- **WHEN** se genera un código de vista previa porque falta `MO` y/o `MD`
- **THEN** el desglose devuelto marca como faltante(s) únicamente el o los segmentos correspondientes a `MO`/`MD`, manteniendo el resto de los segmentos resueltos con su valor real

### Requirement: Presentación del código de diseño dentro del flujo de edición del diseño
El sistema SHALL mostrar el panel del código de diseño únicamente dentro del contenido de la pestaña "DISEÑO" de la pantalla de creación/edición de diseño (no fuera de las pestañas ni dentro de la pestaña "COSTOS"), representando cada segmento del desglose como un elemento visual individual (no solo como texto plano concatenado), y SHALL indicar visualmente cuáles segmentos corresponden a datos faltantes.

#### Scenario: El panel solo aparece en la pestaña de diseño
- **WHEN** el usuario cambia a la pestaña "COSTOS"
- **THEN** el panel del código de diseño no se muestra

#### Scenario: Cada segmento se distingue visualmente
- **WHEN** se muestra un código con segmentos resueltos y segmentos `MO`/`MD` faltantes
- **THEN** el sistema distingue visualmente los segmentos faltantes de los resueltos (por ejemplo, mediante un estilo distinto y una indicación de qué acción falta realizar)

### Requirement: Código de país y segmento final extraídos de la referencia SAP
El sistema SHALL extraer el código de país y el segmento final del código de diseño directamente de la referencia SAP, usando las posiciones configuradas en el mapeo de segmentos SAP, sin aplicar ninguna tabla de conversión adicional sobre esos valores.

#### Scenario: Extracción usando el mapeo de posiciones configurado
- **WHEN** el mapeo de segmentos SAP tiene configurado el índice del código de país en la posición 7 y el índice del segmento final en la posición 4, y la referencia SAP es `1-25-220-120-CV-CTY-NTCA-CO-ST`
- **THEN** el código de país resuelto es `CO` y el segmento final resuelto es `CV`

#### Scenario: Referencia SAP con menos segmentos de los esperados por el mapeo configurado
- **WHEN** la referencia SAP del elemento tiene menos segmentos que el índice más alto configurado en el mapeo de posiciones
- **THEN** el sistema rechaza la generación e informa que la referencia SAP del elemento no tiene el formato esperado

### Requirement: Validación de unicidad del código generado
El sistema SHALL verificar, para todo código de diseño completo (con `MO` y `MD` presentes), si el código propuesto ya existe en otro diseño (`Design.code`), y SHALL informar al usuario cuando exista una coincidencia en lugar de permitir guardarlo directamente. Esta verificación NO SHALL ejecutarse mientras el código sea una vista previa incompleta (ver Requirement "Vista previa del código mientras faltan segmentos MO/MD").

#### Scenario: Código propuesto disponible
- **WHEN** el código generado no coincide con el `code` de ningún diseño existente
- **THEN** el sistema permite continuar con ese código sin advertencias

#### Scenario: Código propuesto ya existe
- **WHEN** el código generado coincide con el `code` de un diseño ya existente
- **THEN** el sistema informa al usuario que el código ya existe y ofrece un código alternativo generado mediante la regla de sufijo de desambiguación predeterminada

### Requirement: Resolución de duplicados mediante sufijo de desambiguación configurable
El sistema SHALL generar un código alternativo cuando exista una colisión, agregando al segmento de año un sufijo (letra o número, con o sin guion) según el formato de sufijo marcado como predeterminado en el catálogo de formatos, incrementando la secuencia hasta encontrar un código libre.

#### Scenario: Primer código alternativo con formato de letra pegada (por defecto)
- **WHEN** el código base `1DAA26MOAL-CO CV` ya existe y el formato de sufijo predeterminado es "letra pegada al año"
- **THEN** el sistema propone `1DAA26AMOAL-CO CV`, y si también existe, continúa con `1DAA26BMOAL-CO CV`, y así sucesivamente

#### Scenario: Formato de sufijo predeterminado distinto
- **WHEN** el formato de sufijo marcado como predeterminado es "número con guion" en vez de "letra pegada"
- **THEN** el sistema propone el siguiente código alternativo siguiendo ese formato (ej. `1DAA26-1MOAL-CO CV`) en lugar del formato de letra

### Requirement: Edición restringida al sufijo de desambiguación
El sistema SHALL permitir editar el código de diseño únicamente cuando éste es un duplicado (`isDuplicate: true`), y en ese caso la edición SHALL limitarse exclusivamente al sufijo de desambiguación (el token que el backend inserta entre el segmento de año y el valor MO). El resto del código SHALL permanecer fijo y no editable en ningún estado.

#### Scenario: Input de sufijo habilitado solo ante duplicado
- **WHEN** el código generado no es un duplicado
- **THEN** no existe ningún campo editable en el panel del código; el código se muestra solo como texto de solo lectura

#### Scenario: Formato del sufijo visible para el usuario
- **WHEN** el sistema detecta un duplicado y habilita el input de sufijo
- **THEN** el sistema muestra debajo del input el formato esperado según la regla de sufijo predeterminada configurada en el backend (ej. "Letra A-Z", "Guion + número"), derivado del campo `suffixPattern` devuelto por el endpoint de generación

#### Scenario: El chip de año se actualiza en tiempo real al escribir el sufijo
- **WHEN** el usuario escribe un valor en el input del sufijo
- **THEN** el chip del segmento "Año" refleja inmediatamente el nuevo valor (año + sufijo escrito) sin necesidad de llamar al servidor, y el código completo mostrado en el panel también se actualiza en tiempo real

### Requirement: Verificación de disponibilidad del sufijo de desambiguación
El sistema SHALL requerir que el usuario verifique explícitamente si el sufijo ingresado genera un código disponible antes de permitir guardar, mediante un botón "Verificar disponibilidad" que consulta al backend en tiempo real. La sugerencia automática del backend SHALL considerarse verificada sin acción adicional del usuario (el algoritmo del backend garantiza que su sugerencia siempre apunta a un código libre).

#### Scenario: Verificación exitosa — sufijo disponible
- **WHEN** el usuario hace clic en "Verificar disponibilidad" y el código resultante no existe en base de datos
- **THEN** el sistema muestra un indicador verde de "Sufijo disponible", el badge del panel cambia a "Completo" y se habilita un botón "Cambiar" para re-editar si se desea

#### Scenario: Verificación fallida — sufijo también duplicado
- **WHEN** el usuario hace clic en "Verificar disponibilidad" y el código resultante ya existe en base de datos
- **THEN** el sistema muestra un aviso inline "Este sufijo también existe" y el usuario puede modificar el valor e intentar nuevamente

#### Scenario: Guardar bloqueado con sufijo sin verificar
- **WHEN** el usuario modifica el sufijo pero no hace clic en "Verificar disponibilidad", e intenta guardar el diseño
- **THEN** el sistema bloquea el guardado e indica que debe verificar la disponibilidad del sufijo antes de continuar

#### Scenario: Guardar bloqueado mientras el código está incompleto
- **WHEN** el usuario intenta guardar el diseño mientras el código sigue siendo una vista previa incompleta (falta `MO` y/o `MD`)
- **THEN** el sistema bloquea el guardado e indica que debe completar el código de diseño

### Requirement: Visualización del código completo ensamblado
El sistema SHALL mostrar en todo momento el código de diseño completo ensamblado como texto prominente dentro del panel, además del desglose por chips individuales, para que el usuario siempre tenga visibilidad exacta del valor que quedará registrado en base de datos.

#### Scenario: Código completo visible mientras se edita el sufijo
- **WHEN** el usuario está editando el sufijo de desambiguación
- **THEN** el código ensamblado completo (incluyendo el sufijo en edición) se actualiza en tiempo real en la zona de texto prominente del panel
