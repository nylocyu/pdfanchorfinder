import assert from "node:assert/strict";
import { findAnchorsInAnnotations } from "./pdf-anchor-finder.mjs";

// FreeText comment annotation (as produced by PDF comment tools)
const found = findAnchorsInAnnotations(
  [{ rect: [10, 20, 40, 30], contentsObj: { str: "$$Signer1" } }],
  "$$Signer1"
);
assert.equal(found.length, 1);
assert.deepEqual(found[0], { x: 10, width: 30, yBottomUp: 20 });

// Filled-in form field value
const fromField = findAnchorsInAnnotations([{ rect: [0, 0, 10, 5], fieldValue: "$$Signer2" }], "$$Signer2");
assert.equal(fromField.length, 1);

// No match, missing rect, or non-string value must not throw / must be skipped
assert.equal(findAnchorsInAnnotations([{ rect: [0, 0, 10, 5], contentsObj: { str: "irrelevant" } }], "$$Signer1").length, 0);
assert.equal(findAnchorsInAnnotations([{ contentsObj: { str: "$$Signer1" } }], "$$Signer1").length, 0);
assert.equal(findAnchorsInAnnotations([{ rect: [0, 0, 10, 5], fieldValue: 42 }], "42").length, 0);

console.log("ok");
