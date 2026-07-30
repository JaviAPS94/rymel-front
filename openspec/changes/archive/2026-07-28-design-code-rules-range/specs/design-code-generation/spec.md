## MODIFIED Requirements

### Requirement: Letra de potencia según fase y valor de potencia
El sistema SHALL resolver la letra de potencia consultando la tabla de conversión configurable correspondiente (monofásica o trifásica, según el segmento de fase de la referencia SAP), buscando la entrada cuyo rango configurado (mínimo y máximo, ambos inclusivos) contenga el valor del segmento de potencia de la referencia SAP.

#### Scenario: Potencia dentro de un rango configurado
- **WHEN** el segmento de fase es `1` (monofásico), el segmento de potencia es `27`, y en la tabla monofásica existe una entrada con rango mínimo `25` y máximo `30` asociada a una letra
- **THEN** el sistema resuelve la letra de esa entrada, aunque `27` no coincida exactamente con `25` ni con `30`

#### Scenario: Potencia igual a un límite del rango
- **WHEN** el segmento de potencia coincide exactamente con el valor mínimo o el valor máximo de una entrada configurada
- **THEN** el sistema resuelve la letra de esa entrada (los límites del rango son inclusivos)

#### Scenario: Potencia no encontrada en ningún rango configurado
- **WHEN** el segmento de potencia de la referencia SAP no cae dentro de ningún rango configurado en la tabla correspondiente a la fase indicada
- **THEN** el sistema rechaza la generación e informa que falta una regla de potencia configurada para ese valor

### Requirement: Letras de tensión primaria y secundaria
El sistema SHALL resolver la letra de tensión primaria y la letra de tensión secundaria consultando, respectivamente, las tablas de conversión configurables de tensión primaria y tensión secundaria, buscando en cada una la entrada cuyo rango configurado (mínimo y máximo, ambos inclusivos) contenga el segmento correspondiente de la referencia SAP.

#### Scenario: Tensiones dentro de rangos configurados
- **WHEN** el segmento de tensión primaria de la referencia SAP es `225` y existe una entrada de tensión primaria con rango mínimo `220` y máximo `230`, y el segmento de tensión secundaria es `120` y existe una entrada de tensión secundaria con rango mínimo `120` y máximo `120`
- **THEN** el sistema resuelve la letra de la entrada de tensión primaria que contiene `225` y la letra de la entrada de tensión secundaria que contiene `120`

#### Scenario: Tensión no encontrada en ningún rango configurado
- **WHEN** un segmento de tensión de la referencia SAP no cae dentro de ningún rango configurado en la tabla correspondiente
- **THEN** el sistema rechaza la generación e informa que falta una regla de tensión configurada para ese valor
