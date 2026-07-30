## MODIFIED Requirements

### Requirement: Administración de la tabla potencia→letra
El sistema SHALL permitir a un usuario con rol `ADMIN` consultar, crear, editar y eliminar entradas de la tabla de conversión de potencia (kVA) a letra, indicando para cada entrada si aplica a fase monofásica o trifásica, y definiendo para cada entrada un rango de potencia (valor mínimo y valor máximo, ambos inclusivos y ambos requeridos) en lugar de un único valor. El sistema SHALL rechazar la creación o edición de una entrada cuyo rango se solape (incluyendo límites compartidos) con el rango de otra entrada activa de la misma fase.

#### Scenario: Alta de una nueva entrada de potencia con rango
- **WHEN** un usuario `ADMIN` crea una entrada con fase trifásica, potencia mínima `70`, potencia máxima `80` y letra `D`
- **THEN** el sistema guarda la entrada y queda disponible para el motor de generación de códigos de diseño

#### Scenario: Edición de una letra existente
- **WHEN** un usuario `ADMIN` edita la letra asociada a un rango de potencia ya configurado
- **THEN** las siguientes generaciones de código usan el nuevo valor, sin afectar los códigos ya generados anteriormente

#### Scenario: Intento de crear un rango de potencia con mínimo mayor que máximo
- **WHEN** un usuario `ADMIN` intenta crear o editar una entrada de potencia con un valor mínimo mayor que el valor máximo
- **THEN** el sistema rechaza la operación e indica que el mínimo no puede ser mayor que el máximo

#### Scenario: Intento de crear un rango de potencia que se solapa con otro existente
- **WHEN** un usuario `ADMIN` intenta crear o editar una entrada de potencia cuyo rango se cruza con el rango de otra entrada activa de la misma fase (incluyendo el caso en que ambos rangos comparten exactamente un límite)
- **THEN** el sistema rechaza la operación e indica que el rango se solapa con una regla existente

### Requirement: Administración de las tablas de tensión primaria y secundaria
El sistema SHALL permitir a un usuario con rol `ADMIN` consultar, crear, editar y eliminar entradas de las tablas de conversión de tensión primaria a letra y de tensión secundaria a letra, de forma independiente entre ambas tablas, definiendo para cada entrada un rango de tensión (valor mínimo y valor máximo, ambos inclusivos y ambos requeridos) en lugar de un único valor. El sistema SHALL rechazar la creación o edición de una entrada cuyo rango se solape (incluyendo límites compartidos) con el rango de otra entrada activa de la misma tabla.

#### Scenario: Alta de una entrada de tensión primaria con rango
- **WHEN** un usuario `ADMIN` crea una entrada de tensión primaria con valor mínimo `210`, valor máximo `230` y letra `A`
- **THEN** el sistema guarda la entrada en la tabla de tensión primaria, sin afectar la tabla de tensión secundaria

#### Scenario: Intento de crear un rango de tensión con mínimo mayor que máximo
- **WHEN** un usuario `ADMIN` intenta crear o editar una entrada de tensión (primaria o secundaria) con un valor mínimo mayor que el valor máximo
- **THEN** el sistema rechaza la operación e indica que el mínimo no puede ser mayor que el máximo

#### Scenario: Intento de crear un rango de tensión que se solapa con otro existente
- **WHEN** un usuario `ADMIN` intenta crear o editar una entrada de tensión primaria o secundaria cuyo rango se cruza con el rango de otra entrada activa de la misma tabla
- **THEN** el sistema rechaza la operación e indica que el rango se solapa con una regla existente
