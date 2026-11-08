import test from "node:test";
import assert from "node:assert/strict";
import { validateReading } from "../lib/validateReading.ts";

const valid = { device: "washer-1", rms: 0.42, door_open: false };
test("accepts the ESP32 JSON contract including zero and open doors", () => {
  assert.equal(validateReading(valid), null);
  assert.equal(validateReading({ ...valid, rms: 0, door_open: true }), null);
});
test("identifies each failed field without coercing strings or integers", () => {
  assert.equal(validateReading(null), "request body must be a JSON object");
  assert.equal(validateReading([]), "request body must be a JSON object");
  assert.equal(validateReading({ ...valid, device: undefined }), "device must be a string");
  assert.match(validateReading({ ...valid, device: "" })!, /^device must contain/);
  assert.match(validateReading({ ...valid, device: "washer 1" })!, /^device must contain/);
  assert.equal(validateReading({ ...valid, rms: "0.42" }), "rms must be a number");
  assert.equal(validateReading({ ...valid, rms: Infinity }), "rms must be finite");
  assert.equal(validateReading({ ...valid, rms: -1 }), "rms must be greater than or equal to 0");
  for (const value of ["false", 0, 1, null, undefined]) {
    assert.equal(validateReading({ ...valid, door_open: value }), "door_open must be a boolean");
  }
});
