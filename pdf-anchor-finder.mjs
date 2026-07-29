#!/usr/bin/env node
/**
 * pdf-anchor-finder.mjs
 * ---------------------------------------------------------------------------
 * Findet frei wählbare Text-Anker (z.B. "$$Signer1", "[[SIG_A]]",
 * "___UNTERSCHRIFT___") in einer PDF und gibt für jeden Treffer die Position
 * und eine vorgeschlagene Größe eines Eingabe-/Signaturfelds zurück.
 *
 * Anwendungsfall: Ihr kontrolliert eure eigene PDF-Vorlage und platziert
 * einmalig einen unauffälligen Marker-Text (z.B. weiße Schrift, 1pt) an der
 * Stelle, an der später ein Formularfeld (Signatur, Datum, Freitext, Stempel,
 * Wasserzeichen, ...) sitzen soll. Dieses Skript liest die Vorlage aus und
 * übersetzt die Anker-Position automatisch in Koordinaten.
 *
 * Das Skript ist bewusst plattform-unabhängig gehalten: Es hat keine
 * Abhängigkeit zu einer bestimmten E-Signatur- oder Formular-API. Die
 * Ausgabe liefert sowohl rohe PDF-Punkt-Koordinaten als auch eine optionale
 * Umrechnung in Pixel-Koordinaten (siehe DISCLAIMER weiter unten) — je
 * nachdem, welches Format eure Ziel-Plattform erwartet, müsst ihr die Werte
 * ggf. weiterverarbeiten oder die Konventionen unten anpassen.
 *
 * WICHTIG: Ein Anker kann mehrfach im Dokument vorkommen (z.B. mehrere
 * Personen an derselben Stelle auf verschiedenen Seiten, oder derselbe
 * Anker für mehrere Felder). Das Skript findet ALLE Vorkommen.
 *
 * Durchsucht werden sowohl der normale Seiteninhalt (Text) als auch
 * Annotationen (z.B. Kommentare/FreeText, ausgefüllte Formularfeldwerte) —
 * also auch Anker, die nachträglich per PDF-Editor/Kommentarfunktion
 * hinzugefügt wurden, statt beim Erstellen der Vorlage in den Seiteninhalt
 * eingebettet zu sein.
 *
 * -----------------------------------------------------------------------------
 * ⚠️  DISCLAIMER — DPI-Umrechnung & Default-Feldgröße
 * -----------------------------------------------------------------------------
 * Dieses Skript trifft zwei Annahmen, die NICHT universell gültig sind,
 * sondern reine Konventionen darstellen, die ihr an eure Ziel-Plattform
 * anpassen müsst:
 *
 *   1. DPI-Umrechnung (96/72): PDFs rechnen intern in "PDF-Punkten" (72 DPI).
 *      Viele Web-/Browser-basierte Plattformen (die mit CSS-Pixeln arbeiten)
 *      verwenden intern 96 DPI als Konvention für "1 CSS-Pixel = 1/96 Zoll".
 *      Das Skript rechnet standardmäßig von PDF-Punkten in solche 96-DPI-
 *      Pixel um (Faktor 96/72 ≈ 1.333). Erwartet eure Ziel-Plattform stattdessen
 *      rohe PDF-Punkte, eine andere DPI-Konvention, oder eigene Skalierung
 *      pro Seite/Viewport — müsst ihr den Faktor über --dpi anpassen oder die
 *      Rohwerte (siehe `pdfPoints` im Output) direkt verwenden.
 *
 *   2. Default-Feldgröße (180×57.6 px, Aspect Ratio 3.125): Das ist keine
 *      universelle Norm, sondern ein willkürlich gewählter Startwert für
 *      ein Signaturfeld im 3.125:1-Verhältnis. Eure Ziel-Plattform hat evtl.
 *      eigene Mindestgrößen, Seitenverhältnis-Vorgaben oder Feldtypen mit
 *      anderen Standardgrößen (z.B. Datumsfelder, Freitextfelder, Checkboxen).
 *      Passt --width/--height/--aspect-ratio an oder überschreibt die Werte
 *      nach der Ausgabe, bevor ihr sie an eure API übergebt.
 *
 * Kurz: Prüft die Werte gegen die Dokumentation eurer Ziel-Plattform, bevor
 * ihr sie produktiv verwendet. Dieses Skript liefert eine Startkoordinate,
 * keine geprüfte/garantierte Endkoordinate für ein bestimmtes System.
 * -----------------------------------------------------------------------------
 *
 * VERWENDUNG
 * -----------------------------------------------------------------------------
 *   node pdf-anchor-finder.mjs <pdf-datei> <anker1> [anker2] [anker3] ...
 *
 * Beispiel:
 *   node pdf-anchor-finder.mjs vertrag.pdf "$$Signer1" "$$Signer2"
 *
 * Optionale Flags (müssen VOR den Ankern stehen):
 *   --width=<px>         Breite des Felds in Ziel-Pixeln (Default: 180)
 *   --height=<px>        Höhe des Felds in Ziel-Pixeln (Default: wird aus
 *                        width via --aspect-ratio berechnet, falls nicht gesetzt)
 *   --aspect-ratio=<n>   Breite/Höhe-Verhältnis für die Default-Höhe (Default: 3.125)
 *   --dpi=<n>            Ziel-DPI für die Pixel-Umrechnung (Default: 96).
 *                        Nutzt --dpi=72, um die Umrechnung zu deaktivieren
 *                        (dann entsprechen die "px"-Werte den PDF-Punkten 1:1).
 *
 * -----------------------------------------------------------------------------
 * AUSGABE
 * -----------------------------------------------------------------------------
 * JSON-Array, ein Eintrag pro gefundenem Anker-Vorkommen, z.B.:
 *
 * [
 *   {
 *     "anchor": "$$Signer1",
 *     "page": 1,
 *     "pdfPoints": { "x": 90.4, "y": 361.4, "width": 135, "height": 43.2 },
 *     "pixels": {
 *       "dpi": 96,
 *       "position": { "x": 120.5, "y": 480.25 },
 *       "size": { "width": 180, "height": 57.6 }
 *     }
 *   }
 * ]
 *
 * `pdfPoints` sind die rohen, plattform-unabhängigen Koordinaten in PDF-Punkten
 * (72 DPI, Ursprung unten links — PDF-Standard). `pixels` ist die optionale
 * Umrechnung gemäß der oben beschriebenen Konvention — siehe Disclaimer.
 * ---------------------------------------------------------------------------
 */

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "fs";
import { resolve } from "path";

const DEFAULT_TARGET_DPI = 96;
const PDF_POINTS_DPI = 72;
const DEFAULT_ASPECT_RATIO = 3.125; // reine Konvention, siehe Disclaimer oben
const DEFAULT_FIELD_WIDTH_PX = 180;

const LINE_Y_TOLERANCE = 2; // pt, Toleranz beim Gruppieren von Textzeilen

// --- Textzeilen gruppieren und den Anker in der zusammengesetzten Zeile suchen ---
// pdfjs teilt einen visuell zusammenhängenden Text (z.B. "$$Signer1") je nach
// Font-/Kerning-Struktur der PDF ggf. auf mehrere Textitems auf. Eine einfache
// Substring-Prüfung pro Item ist deshalb nicht zuverlässig — stattdessen werden
// Items derselben Zeile zusammengesetzt, bevor gesucht wird, und die
// Anker-Position wird anschließend aus den betroffenen Item(s) zurückgerechnet.

function groupItemsByLine(items) {
  const groups = [];
  for (const item of items) {
    if (!item.str) continue;
    const y = item.transform[5];
    let group = groups.find((g) => Math.abs(g.y - y) <= LINE_Y_TOLERANCE);
    if (!group) {
      group = { y, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  for (const group of groups) group.items.sort((a, b) => a.transform[4] - b.transform[4]);
  return groups;
}

function findAnchorsInLine(group, anchorText) {
  let concatenated = "";
  const spans = [];
  for (const item of group.items) {
    spans.push({ item, start: concatenated.length, end: concatenated.length + item.str.length });
    concatenated += item.str;
  }

  const anchors = [];
  let searchFrom = 0;
  let idx;
  while ((idx = concatenated.indexOf(anchorText, searchFrom)) !== -1) {
    const matchEnd = idx + anchorText.length;
    const overlapping = spans.filter((s) => s.start < matchEnd && s.end > idx);
    searchFrom = matchEnd;
    if (overlapping.length === 0) continue;

    const startSpan = overlapping[0];
    const endSpan = overlapping[overlapping.length - 1];

    const startFrac = startSpan.item.str.length > 0 ? (idx - startSpan.start) / startSpan.item.str.length : 0;
    const anchorStartX = startSpan.item.transform[4] + (startSpan.item.width || 0) * startFrac;

    const endFrac = endSpan.item.str.length > 0 ? (matchEnd - endSpan.start) / endSpan.item.str.length : 1;
    const anchorEndX = endSpan.item.transform[4] + (endSpan.item.width || 0) * endFrac;

    anchors.push({
      x: anchorStartX,
      width: Math.max(anchorEndX - anchorStartX, 1),
      yBottomUp: group.y,
    });
  }
  return anchors;
}

function findAnchors(items, anchorText) {
  const groups = groupItemsByLine(items);
  return groups.flatMap((group) => findAnchorsInLine(group, anchorText));
}

// --- Anker in Annotationen suchen (Kommentare/FreeText, ausgefüllte Formularfelder) ---
// page.getTextContent() liefert NUR den eigentlichen Seiteninhalt. Text, der
// nachträglich als Kommentar (z.B. FreeText-Annotation) oder als Wert eines
// Formularfelds hinzugefügt wurde, taucht dort nicht auf und muss separat
// über page.getAnnotations() durchsucht werden.

export function findAnchorsInAnnotations(annotations, anchorText) {
  const anchors = [];
  for (const annot of annotations) {
    const text = annot.contentsObj?.str ?? annot.fieldValue ?? "";
    if (!annot.rect || typeof text !== "string" || !text.includes(anchorText)) continue;
    const [x0, y0, x1] = annot.rect;
    anchors.push({ x: x0, width: Math.max(x1 - x0, 1), yBottomUp: y0 });
  }
  return anchors;
}

// --- Feld zentriert auf der Anker-Position bauen ---
// Nutzt die Koordinatentransformation des Viewports selbst (kein manuelles
// "pageHeight - y"), damit auch gedrehte oder versetzte Seiten korrekt
// behandelt werden.

function buildResultFromAnchor(anchor, pageNum, viewportPdf, viewportPx, anchorText, fieldWidthPx, fieldHeightPx, targetDpi) {
  const anchorCenterX = anchor.x + anchor.width / 2;

  // Rohe PDF-Punkt-Koordinaten (plattform-unabhängig, Ursprung unten links)
  const [pdfX, pdfY] = viewportPdf.convertToViewportPoint(anchor.x, anchor.yBottomUp);
  const pdfWidth = anchor.width;
  // Grobe Höhe des Feldes in PDF-Punkten, abgeleitet aus der Ziel-Feldgröße
  const pdfHeight = (fieldHeightPx / targetDpi) * PDF_POINTS_DPI;

  const result = {
    anchor: anchorText,
    page: pageNum,
    pdfPoints: {
      x: Math.round(pdfX * 100) / 100,
      y: Math.round(pdfY * 100) / 100,
      width: Math.round(pdfWidth * 100) / 100,
      height: Math.round(pdfHeight * 100) / 100,
    },
  };

  if (viewportPx) {
    const [centerX, centerY] = viewportPx.convertToViewportPoint(anchorCenterX, anchor.yBottomUp);
    result.pixels = {
      dpi: targetDpi,
      position: {
        x: Math.round(Math.max(0, centerX - fieldWidthPx / 2) * 100) / 100,
        y: Math.round(Math.max(0, centerY - fieldHeightPx / 2) * 100) / 100,
      },
      size: { width: fieldWidthPx, height: fieldHeightPx },
    };
  }

  return result;
}

// --- Public API (auch importierbar) ---

export async function findAnchorPositions(pdfPath, anchorTexts, options = {}) {
  const targetDpi = options.dpi ?? DEFAULT_TARGET_DPI;
  const fieldWidthPx = options.width ?? DEFAULT_FIELD_WIDTH_PX;
  const aspectRatio = options.aspectRatio ?? DEFAULT_ASPECT_RATIO;
  const fieldHeightPx = options.height ?? Math.round((fieldWidthPx / aspectRatio) * 100) / 100;

  const data = new Uint8Array(readFileSync(resolve(pdfPath)));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;

  const results = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    // viewport bei scale=1 liefert rohe PDF-Punkt-Koordinaten (72 DPI)
    const viewportPdf = page.getViewport({ scale: 1.0 });
    // viewport bei scale=targetDpi/72 liefert Pixel-Koordinaten gemäß der
    // gewählten DPI-Konvention (siehe Disclaimer oben)
    const viewportPx = targetDpi ? page.getViewport({ scale: targetDpi / PDF_POINTS_DPI }) : null;
    const textContent = await page.getTextContent();
    const annotations = await page.getAnnotations();

    for (const anchorText of anchorTexts) {
      const anchors = [
        ...findAnchors(textContent.items, anchorText),
        ...findAnchorsInAnnotations(annotations, anchorText),
      ];
      for (const anchor of anchors) {
        results.push(
          buildResultFromAnchor(anchor, pageNum, viewportPdf, viewportPx, anchorText, fieldWidthPx, fieldHeightPx, targetDpi)
        );
      }
    }
  }

  return results;
}

// --- main (CLI) ---

function parseArgs(argv) {
  const options = {};
  const positional = [];

  for (const arg of argv) {
    const widthMatch = arg.match(/^--width=(\d+(\.\d+)?)$/);
    const heightMatch = arg.match(/^--height=(\d+(\.\d+)?)$/);
    const aspectMatch = arg.match(/^--aspect-ratio=(\d+(\.\d+)?)$/);
    const dpiMatch = arg.match(/^--dpi=(\d+(\.\d+)?)$/);
    if (widthMatch) {
      options.width = parseFloat(widthMatch[1]);
    } else if (heightMatch) {
      options.height = parseFloat(heightMatch[1]);
    } else if (aspectMatch) {
      options.aspectRatio = parseFloat(aspectMatch[1]);
    } else if (dpiMatch) {
      options.dpi = parseFloat(dpiMatch[1]);
    } else {
      positional.push(arg);
    }
  }
  return { options, positional };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

if (isMain) {
  const { options, positional } = parseArgs(process.argv.slice(2));
  const [pdfFile, ...anchorTexts] = positional;

  if (!pdfFile || anchorTexts.length === 0) {
    console.error(
      "Usage: node pdf-anchor-finder.mjs [--width=<px>] [--height=<px>] [--aspect-ratio=<n>] [--dpi=<n>] <pdf-datei> <anker1> [anker2] ..."
    );
    console.error('Beispiel: node pdf-anchor-finder.mjs vertrag.pdf "$$Signer1" "$$Signer2"');
    process.exit(1);
  }

  findAnchorPositions(pdfFile, anchorTexts, options)
  .then((results) => {
    if (results.length === 0) {
      console.log("Keine Anker gefunden.");
      console.log(
        "Prüft: (1) Ist der Anker-Text exakt so in der PDF enthalten (inkl. Groß-/Kleinschreibung, Sonderzeichen)? " +
          "(2) Ist die PDF textbasiert (nicht gescannt/nur Bild)? Gescannte PDFs enthalten keine durchsuchbaren Textinhalte."
      );
    } else {
      console.log(JSON.stringify(results, null, 2));
      console.error(`\n${results.length} Anker-Vorkommen gefunden.`);
      console.error(
        "Hinweis: 'pixels' basiert auf einer DPI-/Größen-Konvention, die ggf. nicht zu eurer Ziel-Plattform passt " +
          "— siehe Disclaimer im Skript-Header. 'pdfPoints' ist die plattform-unabhängige Rohkoordinate."
      );
    }
  })
  .catch((err) => {
    console.error("Fehler beim Verarbeiten der PDF:", err.message);
    process.exit(1);
  });
}
