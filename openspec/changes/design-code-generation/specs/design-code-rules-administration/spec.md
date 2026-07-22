## ADDED Requirements

### Requirement: Administración de la tabla potencia→letra
El sistema SHALL permitir a un usuario con rol `ADMIN` consultar, crear, editar y eliminar entradas de la tabla de conversión de potencia (kVA) a letra, indicando para cada entrada si aplica a fase monofásica o trifásica.

#### Scenario: Alta de una nueva entrada de potencia
- **WHEN** un usuario `ADMIN` crea una entrada con fase trifásica, potencia `75` y letra `D`
- **THEN** el sistema guarda la entrada y queda disponible para el motor de generación de códigos de diseño

#### Scenario: Edición de una letra existente
- **WHEN** un usuario `ADMIN` edita la letra asociada a una potencia ya configurada
- **THEN** las siguientes generaciones de código usan el nuevo valor, sin afectar los códigos ya generados anteriormente

### Requirement: Administración de las tablas de tensión primaria y secundaria
El sistema SHALL permitir a un usuario con rol `ADMIN` consultar, crear, editar y eliminar entradas de las tablas de conversión de tensión primaria a letra y de tensión secundaria a letra, de forma independiente entre ambas tablas.

#### Scenario: Alta de una entrada de tensión primaria
- **WHEN** un usuario `ADMIN` crea una entrada de tensión primaria con valor `220` y letra `A`
- **THEN** el sistema guarda la entrada en la tabla de tensión primaria, sin afectar la tabla de tensión secundaria

### Requirement: Administración del mapeo de posiciones de segmentos SAP
El sistema SHALL permitir a un usuario con rol `ADMIN` configurar, para cada segmento lógico usado en la generación del código (fase, potencia, tensión primaria, tensión secundaria, segmento final, código de país), qué posición ocupa dentro de la referencia SAP al separarla por guiones.

#### Scenario: Cambio de la posición configurada del código de país
- **WHEN** un usuario `ADMIN` actualiza la posición configurada para el segmento "código de país" de 7 a 6
- **THEN** las siguientes generaciones de código extraen el código de país de la posición 6 de la referencia SAP

### Requirement: Administración del catálogo de formatos de sufijo de desambiguación
El sistema SHALL permitir a un usuario con rol `ADMIN` consultar, crear, editar, eliminar y marcar como predeterminado un formato dentro del catálogo de formatos de sufijo de desambiguación (usados para resolver códigos de diseño duplicados), existiendo en todo momento como máximo un formato predeterminado.

#### Scenario: Cambio del formato de sufijo predeterminado
- **WHEN** un usuario `ADMIN` marca el formato "número con guion" como predeterminado
- **THEN** el formato previamente predeterminado deja de serlo, y las siguientes resoluciones de duplicados usan el formato "número con guion"

#### Scenario: Intento de eliminar el único formato predeterminado
- **WHEN** un usuario `ADMIN` intenta eliminar el formato actualmente marcado como predeterminado
- **THEN** el sistema rechaza la eliminación e indica que debe asignarse otro formato como predeterminado antes de eliminarlo

### Requirement: Restricción de acceso a la administración de reglas
El sistema SHALL restringir el acceso a las pantallas y endpoints de administración de reglas de código de diseño exclusivamente a usuarios con rol `ADMIN`.

#### Scenario: Usuario sin rol ADMIN intenta acceder
- **WHEN** un usuario autenticado sin rol `ADMIN` intenta acceder a una pantalla o endpoint de administración de reglas de código de diseño
- **THEN** el sistema deniega el acceso
