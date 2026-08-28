# Visual thesis — the working recovery sheet

Change Recovery Ledger uses a **risograph tactile collage** drawn from the objects developers reach for when a long session goes wrong: taped notes, marked-up diffs, registration crosses, and numbered evidence bags. The interface should feel like a careful workbench, not another glowing Git dashboard. Its imperfect print texture humanizes a high-stakes operation while the rigid ledger grid keeps every action legible.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#F1E9D2` | Main canvas; warm recycled stock |
| Paper high | `#FFF9E9` | Input fields and active sheets |
| Ink | `#171713` | Text, borders, and decisive actions |
| Ink muted | `#5D594D` | Secondary text (7.0:1 on Paper) |
| Riso orange | `#B9361F` | Primary action and removed lines; 5.1:1 with paper text |
| Orange dark | `#8F2B18` | Accessible links and hover states |
| Process blue | `#145C70` | Selected files and added lines |
| Blue dark | `#0B4050` | Text on pale surfaces |
| Proof yellow | `#EBCB53` | Warnings and registration marks |
| Moss | `#315B3A` | Passed checks and restored states |
| Danger | `#84221E` | Destructive warnings |

The product is intentionally single-mode. Paper and two overprinted inks are central to the risograph metaphor; a dark theme would turn the page into a screen and weaken that identity. Every page paints the paper background explicitly.

## Type

- Display: **Arial Black**, then `Impact`, then a heavy system sans. Tight spacing makes headings read like stamped issue labels. No font file is downloaded.
- Body and utility: **ui-monospace**, `SFMono-Regular`, `Cascadia Code`, `Liberation Mono`, monospace. Commands, file paths, and prose share one dependable character grid.
- Scale: 14, 16, 18, 24, 40, and clamp(48–76) pixels. Body text never drops below 16 pixels.
- Tables and counters use tabular figures.

## Spacing and shape

- Base unit: 8px. Common gaps: 8, 16, 24, 32, 48, 72, 96.
- Reading measure: 66 characters.
- Corners are clipped or nearly square (`0–4px`). Cards are reserved for distinct checkpoint records.
- Borders are 2px ink strokes. A 4px offset shadow resembles a second ink pass.
- Torn-paper diagonals and tape strips mark transitions. Registration crosses repeat as the signature motif.

## Interaction grammar

- Orange means act; blue means selected or inspect; moss confirms a completed safety check.
- Primary buttons press down into their offset shadow. Links stay underlined.
- File rows are real checkboxes with 44px hit areas. A selected row gains a blue screen-print band as well as a checkmark.
- Restore always names the file count and opens a confirmation. Reversal creates a safety checkpoint first.
- Replay means export a patch. The app never runs it.
- Route changes move focus to the page heading and announce the title.

## Motion policy

The signature motion is **ink registration**: a new sheet arrives with orange and blue layers offset by 6px, then aligns over 220ms. Buttons move 2px when pressed. Progress is a stepped print bar, not a spinner. Nothing loops. Under `prefers-reduced-motion: reduce`, layers appear aligned immediately and all scrolling is instant.

## Art direction and asset plan

Hero subject: an overhead recovery workbench made from torn code listings, a transparent patch sheet, red thread, a graphite pencil, file tabs, and registration crosses. One gloved hand lifts only one faulty strip while the remaining strips stay pinned. The visual explains selective reversal.

World and materials: tactile recycled paper, fibrous edges, coarse soy ink, halftone dots, slight two-color misregistration, analog shadows.

Light and lens: flat overhead editorial lighting, 35mm-equivalent top-down frame, strong negative space, no photorealistic interface.

Palette words: unbleached paper, carbon black, vermilion orange, petroleum blue, proof yellow.

Negative list: no readable text, no logos, no brands, no gradients, no glossy 3D, no neon, no human face, no extra fingers, no watermark, no fake app UI.

Assets:

- `hero-ledger.webp`: generated 3:2 hero collage, cropped responsively, ≤300 KB.
- `social-card.png`: locally cropped from the hero at 1200×630.
- `walkthrough-1.webp` through `walkthrough-3.webp`: screenshots of the shipped sample recovery, captured in Chromium.
- favicon and UI marks: original hand-authored SVG registration cross and ledger tab shapes.

## Provenance

The hero illustration is original generated artwork for this product. Generated with the factory image model (`factory-image`) on 2026-08-28 using `/opt/fleet/lib/gen-image.sh`. The final prompt is stored at `assets/src/hero-ledger.prompt.json`. The social card is composed locally from that output. MIT project license; no third-party visual assets.
