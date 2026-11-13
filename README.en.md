# pdf-anchor-finder

🌐 [Deutsch](./README.md) | **English**

Finds freely chosen text anchors in a PDF (e.g. `$$Signer1`, `[[SIG_A]]`,
`___SIGNATURE___`) and translates their position into coordinates suitable
for placing form fields (signature, date, free text, stamp, ...).

Use case: you control your own PDF template. You place an inconspicuous
marker text once (e.g. white font, 1pt) at the spot where a form field
should appear later. This script reads the template and automatically finds
the position of all markers.

The script is **platform-independent** — it has no dependency on any
specific e-signature or form API. You may need to adapt the output to the
format of your target platform (see disclaimer below).

## ⚠️ Disclaimer — DPI conversion & default field size

This script makes two assumptions that are **not universal standards**, but
merely conventions:

1. **DPI conversion (default: 96):** PDFs internally use PDF points
   (72 DPI). Many web/browser-based platforms use 96 DPI as the convention
   for CSS pixels. By default, the script provides a 96 DPI conversion in
   addition to the raw PDF points. If your target platform expects
   different values, adjust `--dpi` or use the `pdfPoints` values from the
   output directly.
2. **Default field size (180×57.6 px, aspect ratio 3.125):** This is an
   arbitrarily chosen starting value, not a standard. Your target platform
   may have its own minimum sizes or aspect ratio requirements. Adjust
   `--width` / `--height` / `--aspect-ratio` accordingly.

**Check the values against your target platform's documentation** before
using them in production. The script provides a starting coordinate, not a
final coordinate guaranteed for any particular system.

## Requirements

- Node.js ≥ 18
- A text-based PDF (no scanned/image-only PDFs — the text must be
  searchable)

## Installation

```bash
npm install
```

## Usage

```bash
node pdf-anchor-finder.mjs <pdf-file> <anchor1> [anchor2] [anchor3] ...
```

Example:

```bash
node pdf-anchor-finder.mjs contract.pdf "$$Signer1" "$$Signer2"
```

### Optional flags (specify before the anchors)

| Flag | Description | Default |
|---|---|---|
| `--width=<px>` | Field width in target pixels | `180` |
| `--height=<px>` | Field height in target pixels | calculated from `--aspect-ratio` |
| `--aspect-ratio=<n>` | Width/height ratio for the default height | `3.125` |
| `--dpi=<n>` | Target DPI for the pixel conversion; `--dpi=72` effectively disables the conversion (px = PDF points) | `96` |

## Output

```json
[
  {
    "anchor": "$$Signer1",
    "page": 1,
    "pdfPoints": { "x": 90.4, "y": 361.4, "width": 135, "height": 43.2 },
    "pixels": {
      "dpi": 96,
      "position": { "x": 120.5, "y": 480.25 },
      "size": { "width": 180, "height": 57.6 }
    }
  }
]
```

- `pdfPoints`: raw, platform-independent coordinates in PDF points
  (72 DPI, origin bottom left — PDF standard).
- `pixels`: optional conversion according to the convention described
  above — **see disclaimer** before using these values in production.

## Notes

- An anchor can occur multiple times (e.g. on several pages) — the script
  finds and lists every occurrence individually.
- Both the page content and annotations (comments/FreeText, filled-in form
  field values) are searched — so anchors added later via a PDF editor are
  found as well.
- If no match is returned, check: (1) Does the anchor text match exactly
  (case, special characters)? (2) Is the PDF text-based and not just a
  scanned image?

## License

MIT — see [LICENSE](./LICENSE). This project is an independent community
tool with no affiliation to or support from any specific product/company.
