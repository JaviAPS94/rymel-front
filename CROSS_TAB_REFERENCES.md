# Cross-Tab Cell References

## Overview

You can now reference cells between the Design and Cost tabs!

## Syntax

### Within Same Tab

```
=Sheet1!A1
```

### Between Design and Cost Tabs

```
=design:SubDiseño1!A1    // Reference Design tab from Cost tab
=cost:Hoja1!B5           // Reference Cost tab from Design tab
```

## Example Use Case

**Design Tab - SubDiseño1:**

- Cell A1: `100` (base cost)
- Cell A2: `50` (material cost)

**Cost Tab - Hoja1:**

- Cell A1: `=design:SubDiseño1!A1 * 1.15` → Result: 115 (adds 15% markup)
- Cell A2: `=design:SubDiseño1!A1 + design:SubDiseño1!A2` → Result: 150 (total)
- Cell A3: `=A2 * 0.10` → Result: 15 (10% tax on local total)

## How to Use

1. **Manual Typing:**

   - Type: `=design:SubDiseño1!A1`

2. **Click to Add (Coming Soon):**
   - Currently, you need to type the full reference manually
   - Future update will allow clicking cells across tabs

## Supported Functions

✅ Works with: `+`, `-`, `*`, `/`, `^`, `SUM()`, `AVERAGE()`, custom functions
❌ Ranges across tabs not supported: `=design:Sheet1!A1:A10`
