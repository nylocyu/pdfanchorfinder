# pdf-anchor-finder

Findet frei wählbare Text-Anker in einer PDF (z. B. `$$Signer1`, `[[SIG_A]]`,
`___UNTERSCHRIFT___`) und übersetzt deren Position in Koordinaten, die sich
für die Platzierung von Formularfeldern (Signatur, Datum, Freitext, Stempel,
...) eignen.

Anwendungsfall: Ihr kontrolliert eure eigene PDF-Vorlage. Ihr platziert
einmalig einen unauffälligen Marker-Text (z. B. weiße Schrift, 1pt) an der
Stelle, an der später ein Formularfeld sitzen soll. Dieses Skript liest die
Vorlage aus und findet automatisch die Position aller Marker.

Das Skript ist **plattform-unabhängig** — es hat keine Abhängigkeit zu einer
bestimmten E-Signatur- oder Formular-API. Ihr müsst die Ausgabe ggf. an das
Format eurer Ziel-Plattform anpassen (siehe Disclaimer unten).

## ⚠️ Disclaimer — DPI-Umrechnung & Default-Feldgröße

Dieses Skript trifft zwei Annahmen, die **keine universellen Standards sind**,
sondern reine Konventionen darstellen:

1. **DPI-Umrechnung (Standard: 96):** PDFs rechnen intern in PDF-Punkten
   (72 DPI). Viele Web-/Browser-basierte Plattformen verwenden 96 DPI als
   Konvention für CSS-Pixel. Das Skript liefert standardmäßig eine
   96-DPI-Umrechnung zusätzlich zu den rohen PDF-Punkten. Erwartet eure
   Ziel-Plattform andere Werte, passt `--dpi` an oder nutzt direkt die
   `pdfPoints`-Werte aus der Ausgabe.
2. **Default-Feldgröße (180×57.6 px, Aspect Ratio 3.125):** Das ist ein
   willkürlich gewählter Startwert, keine Norm. Eure Ziel-Plattform hat
   möglicherweise eigene Mindestgrößen oder Seitenverhältnis-Vorgaben.
   Passt `--width` / `--height` / `--aspect-ratio` entsprechend an.

**Prüft die Werte gegen die Dokumentation eurer Ziel-Plattform**, bevor ihr
sie produktiv verwendet. Das Skript liefert eine Startkoordinate, keine für
ein bestimmtes System garantierte Endkoordinate.

## Voraussetzungen

- Node.js ≥ 18
- Eine textbasierte PDF (keine gescannten/reinen Bild-PDFs — der Text muss
  durchsuchbar sein)

## Installation

```bash
npm install
```

## Verwendung

```bash
node pdf-anchor-finder.mjs <pdf-datei> <anker1> [anker2] [anker3] ...
```

Beispiel:

```bash
node pdf-anchor-finder.mjs vertrag.pdf "$$Signer1" "$$Signer2"
```

### Optionale Flags (vor den Ankern angeben)

| Flag | Beschreibung | Default |
|---|---|---|
| `--width=<px>` | Feldbreite in Ziel-Pixeln | `180` |
| `--height=<px>` | Feldhöhe in Ziel-Pixeln | aus `--aspect-ratio` berechnet |
| `--aspect-ratio=<n>` | Breite/Höhe-Verhältnis für Default-Höhe | `3.125` |
| `--dpi=<n>` | Ziel-DPI für die Pixel-Umrechnung; `--dpi=72` deaktiviert die Umrechnung effektiv (px = PDF-Punkte) | `96` |

## Ausgabe

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

- `pdfPoints`: rohe, plattform-unabhängige Koordinaten in PDF-Punkten
  (72 DPI, Ursprung unten links — PDF-Standard).
- `pixels`: optionale Umrechnung gemäß der oben beschriebenen Konvention —
  **siehe Disclaimer**, bevor ihr diese Werte produktiv nutzt.

## Hinweise

- Ein Anker kann mehrfach vorkommen (z. B. auf mehreren Seiten) — das Skript
  findet und listet alle Vorkommen einzeln auf.
- Durchsucht werden sowohl der Seiteninhalt als auch Annotationen (Kommentare/
  FreeText, ausgefüllte Formularfeldwerte) — auch nachträglich per PDF-Editor
  hinzugefügte Anker werden also gefunden.
- Kommt kein Treffer zurück, prüft: (1) Stimmt der Anker-Text exakt überein
  (Groß-/Kleinschreibung, Sonderzeichen)? (2) Ist die PDF textbasiert und
  nicht nur ein eingescanntes Bild?

## Lizenz

MIT — siehe [LICENSE](./LICENSE). Dieses Projekt ist ein unabhängiges
Community-Tool ohne Zusammenhang zu oder Support durch ein bestimmtes
Produkt/Unternehmen.
