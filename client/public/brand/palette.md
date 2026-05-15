# YCM Brand Palette — v1 (ratified 2026-05-11)

Selected variant: **v16-05 "Cream + cool white"**

## Colors

| Token | Hex | Use |
|---|---|---|
| `--ycm-sky` | `#5B7DA3` | Background ("slate blue sky") |
| `--ycm-teal` | `#2DBDB0` | Roof, lit windows, baseline accent |
| `--ycm-cream` | `#F0E5D2` | Side building walls (warm tone) |
| `--ycm-cool-white` | `#F6F9FF` | Center building wall (cool tone) |
| `--ycm-navy` | `#0B1B3B` | Unlit window cells (dark contrast) |

## Geometry notes

- 3 buildings, equal width
- Center building has pitched teal roof + extra height
- Side buildings (Y on left, M on right) host the YCM monogram via lit-window patterns
- Windows offset outward (left building windows shift left, right building right)
- Asymmetric vertical offset (left building windows sit lower than right) — gives the logo subtle motion
- Inter-building gap ≤ outer canvas margin (William's spec)

## Source

Programmatic SVG generator: `archive/build-v16.py` (or copy via `git log` in
YCM repo). All exploration drafts archived for posterity.
