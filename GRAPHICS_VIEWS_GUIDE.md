# Graphics Views Guide - Transformer Component Visualization

## Overview

The spreadsheet now supports technical drawings showing different views (FRONTAL and SUPERIOR) of transformer components (NÚCLEO, BOBINA, TANQUE). Graphics are rendered directly in cells using merged cell areas with coordinate grids for precise measurements.

## Features

### Coordinate Grid System

All graphics include:

- **Grid lines**: Light grey lines every 50mm for scale reference
- **X-axis labels**: Horizontal measurements in millimeters (mm) at the bottom
- **Y-axis labels**: Vertical measurements in millimeters (mm) on the left
- **Origin (0,0)**: Located at bottom-left corner (standard engineering convention)
- **Axis labels**: "mm" units displayed on both axes

The grid automatically scales with the component dimensions, providing accurate measurement references.

## Formula Syntax

```
=DRAW:VIEW:COMPONENTS[:dimensionCells]
```

### Parameters:

- **VIEW**: `FRONTAL` or `SUPERIOR`
- **COMPONENTS**: Comma-separated list of components: `NUCLEO`, `BOBINA`, `TANQUE`
- **dimensionCells** (optional): Cell references for dimensions

## Supported Views

### 1. FRONTAL View - NUCLEO Only

**Formula:** `=DRAW:FRONTAL:NUCLEO`

Shows the front view of NUCLEO with:

- Grey outer rectangle
- Two white inner rectangles side-by-side
- Dimension arrows showing height (Alto) and width (Ancho)

**Represents:** Image 1 from your screenshots

### 2. SUPERIOR View - NUCLEO + BOBINA

**Formula:** `=DRAW:SUPERIOR:NUCLEO,BOBINA`

Shows the top view with:

- Grey rectangle (NUCLEO)
- Brown semicircles at top and bottom (BOBINA)
- Height dimension (Profundidad)

**Represents:** Image 2 from your screenshots

### 3. FRONTAL View - All Components

**Formula:** `=DRAW:FRONTAL:TANQUE,NUCLEO,BOBINA`

Shows the front view with:

- Black outer rectangle (TANQUE)
- Grey middle rectangle (NUCLEO)
- Brown inner rectangle (BOBINA)
- Dimension arrows for height and width

**Represents:** Image 3 from your screenshots

### 4. SUPERIOR View - All Components

**Formula:** `=DRAW:SUPERIOR:TANQUE,NUCLEO,BOBINA`

Shows the top view with:

- Black circle (TANQUE)
- Grey rectangle centered inside (NUCLEO)
- Brown semicircles at top/bottom of rectangle (BOBINA)
- Diagonal dimension line for TANQUE diameter

**Represents:** Image 4 from your screenshots

## Cell Setup Requirements

### Recommended Merged Cell Sizes:

- **FRONTAL NUCLEO:** At least 4x4 cells
- **SUPERIOR NUCLEO+BOBINA:** At least 4x5 cells
- **FRONTAL ALL:** At least 5x6 cells
- **SUPERIOR ALL:** At least 6x6 cells (needs space for circle)

### How to Merge Cells:

1. Select the cell range (e.g., A10:D14 for a 4x4 area)
2. Right-click → "Merge Cells"
3. Enter the DRAW formula

## With Dimension References (Optional)

You can specify cell references for dimensions:

```
=DRAW:VIEW:COMPONENTS:nucleoAlto,nucleoAncho:bobinaProfundidad:tanqueAlto,tanqueDiametro
```

### Example with Cell References:

```
=DRAW:FRONTAL:NUCLEO:B4,B5
```

- Uses cell B4 for NUCLEO Alto
- Uses cell B5 for NUCLEO Ancho

```
=DRAW:SUPERIOR:NUCLEO,BOBINA:C4,C5:D6
```

- C4: NUCLEO Alto
- C5: NUCLEO Ancho
- D6: BOBINA Profundidad

```
=DRAW:SUPERIOR:TANQUE,NUCLEO,BOBINA:C4,C5:D6:E4,E6
```

- C4,C5: NUCLEO Alto and Ancho
- D6: BOBINA Profundidad
- E4,E6: TANQUE Alto and Diametro

## Default Dimensions

If you don't specify cell references, these defaults are used:

- **NUCLEO:** Alto=340mm, Ancho=339.08mm
- **BOBINA:** Profundidad=315.85mm
- **TANQUE:** Alto=740mm, Diametro=433.52mm

## Complete Example

### Spreadsheet Setup:

```
     A              B          C                D          E              F
1  Dimensiones
2
3  Núcleo                    Bobina                      Tanque
4  Alto (mm)      340,00     Profundidad(mm)  315,85     Alto (mm)      740,00
5  Ancho (mm)     339,08                                 Diámetro (mm)  433,52
6
7  Vista Frontal - Núcleo                Vista Superior - Núcleo + Bobina
8  [Merged A8:D12]                       [Merged E8:H13]
9  =DRAW:FRONTAL:NUCLEO:B4,B5           =DRAW:SUPERIOR:NUCLEO,BOBINA:B4,B5:D4
10
11
12
13 Vista Frontal - Todos                 Vista Superior - Todos
14 [Merged A14:E19]                      [Merged F14:K19]
15 =DRAW:FRONTAL:TANQUE,NUCLEO,         =DRAW:SUPERIOR:TANQUE,NUCLEO,
16 BOBINA:B4,B5:D4:E4,E5                BOBINA:B4,B5:D4:E4,E5
```

## Visual Details

### Color Scheme:

- **NUCLEO:** Light grey (#CCCCCC)
- **BOBINA:** Brown/Golden (#B8860B)
- **TANQUE:** Black outline (when outer)

### Dimension Arrows:

- Purple arrows (#6B46C1)
- Show actual dimension values from cells or defaults
- Positioned outside the shapes

## Troubleshooting

### "Cell too small" Error

- Merge more cells to increase available space
- Each view type has different space requirements
- SUPERIOR ALL view needs the most space (circular TANQUE)

### Components Not Showing

- Check formula syntax: VIEW and COMPONENTS must be uppercase
- Components must be comma-separated without spaces after commas
- Ensure merged cell area is large enough

### Wrong Dimensions

- Verify cell references point to correct cells
- Check that dimension cells contain valid positive numbers
- Use comma or period for decimals (both work)

## Tips

1. **Start with default dimensions** to test the formulas, then add cell references
2. **Order matters for FRONTAL ALL**: Largest (TANQUE) is drawn first, then NUCLEO, then BOBINA inside
3. **SUPERIOR views** always show components layered on top of each other
4. **Merge cells first** before entering formulas to avoid cell-too-small errors
