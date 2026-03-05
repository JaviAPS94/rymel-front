# Graphics Visualization - Inline Cell Graphics Guide

## Overview

The SpreadSheet component allows you to embed technical drawings of electrical transformer components directly into cells using the `DRAW:` formula syntax.

## Formula Syntax

```
DRAW:type:altoCell:anchoCell:extraCell
```

- **type**: Component type (`NUCLEO`, `BOBINA`, or `TANQUE`)
- **altoCell**: Cell reference for height (optional)
- **anchoCell**: Cell reference for width (optional)
- **extraCell**: Cell reference for diagonal/depth/diameter (optional)

If cell references are not provided, default dimensions will be used.

## Using Merged Cells (Recommended)

**⚠️ Important:** Graphics need adequate space to render properly.

### How to Merge Cells:

1. Select multiple cells (e.g., a 4x4 area)
2. Right-click and select "Merge Cells" or use the merge button
3. Enter the `DRAW:` formula in the merged cell

### Minimum Recommended Sizes:

- **NUCLEO:** ~200x200px minimum (merge at least 3x3 cells)
- **BOBINA:** ~180x180px minimum (merge at least 3x3 cells)
- **TANQUE:** ~350x300px minimum (merge at least 5x4 cells, TANQUE needs extra width for side view)

If the cell is too small, you'll see:

```
Cell too small
Min: 240x220px
Merge cells to enlarge
```

## Supported Components

### 1. Núcleo (Core)

- **Dimensions:**
  - Alto (mm) - Height
  - Ancho (mm) - Width
  - Diagonal (mm) - Diagonal measurement
- **Visual:** Light gray rectangle with rounded top, inner split rectangles
- **Default:** 340 x 339.08 x 353.52 mm

### 2. Bobina (Coil)

- **Dimensions:**
  - Alto (mm) - Height
  - Ancho (mm) - Width
  - Profundidad (mm) - Depth
- **Visual:** Golden rectangle with inner coil representation
- **Default:** 180 x 179.08 x 315.85 mm

### 3. Tanque (Tank)

- **Dimensions:**
  - Alto (mm) - Height
  - Ancho (mm) - Width
  - Diámetro (mm) - Diameter
- **Visual:** Light gray rectangle with circular side view
- **Default:** 740 x 493.5 x 433.5 mm

## Quick Start Example

### Step 1: Create dimension data

```
     A              B          C                D          E              F
1  Dimensiones
2
3  Núcleo                    Bobina                      Tanque
4  Alto (mm)      340,00     Alto (mm)        180,00     Alto (mm)      740,00
5  Ancho (mm)     339,08     Ancho (mm)       179,08     Ancho (mm)     493,5
6  Diagonal (mm)  353,52     Profundidad (mm) 315,85     Diámetro (mm)  433,5
```

### Step 2: Draw graphics in cells

**Using cell references:**

```
Cell A8 (merged 3x3): =DRAW:NUCLEO:B4:B5:B6
Cell C8 (merged 3x3): =DRAW:BOBINA:D4:D5:D6
Cell E8 (merged 5x4): =DRAW:TANQUE:F4:F5:F6
```

**Using default dimensions:**

```
Cell A15 (merged 3x3): =DRAW:NUCLEO
Cell C15 (merged 3x3): =DRAW:BOBINA
Cell E15 (merged 5x4): =DRAW:TANQUE
```

### Result:

Technical drawings appear directly in the merged cells showing the component dimensions with visual arrows and measurements!

## Formula Examples

### With Cell References:

```
=DRAW:NUCLEO:B4:B5:B6
```

Draws a Núcleo using:

- Alto from cell B4
- Ancho from cell B5
- Diagonal from cell B6

```
=DRAW:BOBINA:C10:C11:C12
```

Draws a Bobina using dimensions from cells C10, C11, C12

### With Default Dimensions:

```
=DRAW:NUCLEO
```

Uses default dimensions: 340 x 339.08 x 353.52 mm

```
=DRAW:BOBINA
```

Uses default dimensions: 180 x 179.08 x 315.85 mm

```
=DRAW:TANQUE
```

Uses default dimensions: 740 x 493.5 x 433.5 mm

## Best Practices

### 1. Always Merge Cells First

Before entering a DRAW formula:

- Select a range of cells (3x3 minimum for NUCLEO/BOBINA, 5x4 for TANQUE)
- Right-click → Merge Cells
- Then enter the formula

### 2. Check Dimensions

- Make sure referenced cells contain valid positive numbers
- Negative or zero values will show "Invalid dimensions" error

### 3. Adjust Cell Size

If you see "Cell too small" message:

- The message shows minimum recommended size (e.g., "Min: 240x220px")
- Merge more cells to increase available space
- Or adjust column widths and row heights

### 4. Formula Format

- Type is case-sensitive: use `NUCLEO`, `BOBINA`, or `TANQUE` (all caps)
- Cell references are not case-sensitive: `b4` or `B4` both work
- Separate parameters with colon `:`

## Features

### Visual Components

Each graphic includes:

- **Rectangle body** with rounded semicircular top
- **Dimension arrows** showing width and height
- **Measurement labels** with actual values
- **Component-specific details**:
  - NUCLEO: Split inner rectangles
  - BOBINA: Inner coil visualization
  - TANQUE: Circular side view with diameter

### Dynamic Updates

- Change dimension values in referenced cells
- Graphics update automatically
- No need to re-enter the formula

### Scaling

- Graphics automatically scale to fit the cell
- Maintains aspect ratio
- Shows dimension arrows and labels at appropriate scale

## Example Layout

Complete spreadsheet with dimensions and graphics:

```
     A              B          C                D          E              F
1  Dimensiones
2
3  Núcleo                    Bobina                      Tanque
4  Alto (mm)      340,00     Alto (mm)        180,00     Alto (mm)      740,00
5  Ancho (mm)     339,08     Ancho (mm)       179,08     Ancho (mm)     493,5
6  Diagonal (mm)  353,52     Profundidad (mm) 315,85     Diámetro (mm)  433,5
7
8  [Merged 3x3]             [Merged 3x3]                [Merged 5x4]
9  DRAW:NUCLEO:             DRAW:BOBINA:                DRAW:TANQUE:
10 B4:B5:B6                 D4:D5:D6                    F4:F5:F6
11 [Graphic renders]        [Graphic renders]           [Graphic renders]
```

## Troubleshooting

### "Cell too small" Error

**Problem:** Message shows "Cell too small" with minimum size

**Solution:**

1. Merge more cells to increase the drawing area
2. Increase column width: click column header and drag
3. Increase row height: click row header and drag
4. Check the minimum size suggestion in the error message

### "Invalid dimensions" Error

**Problem:** Red text shows "Invalid dimensions"

**Solutions:**

- Ensure all dimension cells contain positive numbers
- Check for zero or negative values
- Verify cell references are correct (e.g., B4 contains a number, not text)
- Check for typos in cell references

### Graphic Not Showing

**Possible causes:**

1. **Wrong formula format**: Must start with `DRAW:` (with equals sign: `=DRAW:`)
2. **Invalid type**: Must be exactly `NUCLEO`, `BOBINA`, or `TANQUE` (uppercase)
3. **Cell too small**: Merge more cells
4. **Missing cell data**: Referenced cells are empty or contain text

### Formula Not Working

**Check:**

- Formula starts with `=` sign: `=DRAW:NUCLEO`
- Type name is uppercase: `NUCLEO` not `nucleo` or `Nucleo`
- Colons separate parameters: `DRAW:NUCLEO:B4:B5:B6`
- Cell references exist and contain numbers

## Tips

1. **Start Simple**: Try `=DRAW:NUCLEO` with default dimensions first
2. **Decimal Format**: Use comma (339,08) or period (339.08) - both work
3. **Cell References**: Can be relative (B4) or absolute ($B$4)
4. **Units**: Keep all dimensions in millimeters (mm) for consistency
5. **Layout**: Put dimension data in nearby cells for easy reference

## Technical Details

### Default Dimensions

| Component | Alto (mm) | Ancho (mm) | Extra (mm)     |
| --------- | --------- | ---------- | -------------- |
| NUCLEO    | 340.00    | 339.08     | 353.52 (diag)  |
| BOBINA    | 180.00    | 179.08     | 315.85 (depth) |
| TANQUE    | 740.00    | 493.50     | 433.50 (diam)  |

### Scaling Behavior

- Graphics scale down to fit cell size
- Padding: 40px on all sides
- Minimum cell size: 100x100px
- Maintains aspect ratio based on actual dimensions

### Component Colors

- **NUCLEO**: Light gray (#CCCCCC) with white inner rectangles
- **BOBINA**: Golden (#B8860B) with darker inner coil (#8B6914)
- **TANQUE**: Light gray (#DDDDDD) with circular side view

## Visual Reference

### NUCLEO (Transformer Core)

- Main rectangle with rounded top
- Two side-by-side inner rectangles (split core)
- Width and height dimension arrows
- Small circles at top and bottom

### BOBINA (Coil)

- Golden rectangle with rounded top
- Inner rectangular coil representation
- Depth visualization in inner rectangle
- Dimension arrows with labels

### TANQUE (Tank)

- Large light gray rectangle
- Circular side view showing diameter
- Inner rectangle in circle view
- Diagonal diameter line in purple
- Suitable for larger merged cell areas

---

**Note:** This replaces the previous auto-detection graphics board. Graphics now render directly in cells for better integration with your spreadsheet layout.
