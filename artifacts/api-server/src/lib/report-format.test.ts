import assert from "node:assert/strict";
import test from "node:test";
import {
  esc,
  formatDate,
  formatMinorUnits,
  formatMoney,
  formatTenure,
  formatTimestamp,
  humanizeComponent,
  minorDigitsFor,
} from "./report-format";

test("minorDigitsFor: known/unknown/null currencies", () => {
  assert.equal(minorDigitsFor("AED"), 2);
  assert.equal(minorDigitsFor("aed"), 2);
  assert.equal(minorDigitsFor("KWD"), 3);
  assert.equal(minorDigitsFor("JPY"), 0);
  assert.equal(minorDigitsFor("XYZ"), 2); // default
  assert.equal(minorDigitsFor(null), 2);
  assert.equal(minorDigitsFor(undefined), 2);
});

test("formatMinorUnits: 2-decimal currencies group thousands", () => {
  assert.equal(formatMinorUnits(1_200_000, "AED"), "12,000.00");
  assert.equal(formatMinorUnits(0, "AED"), "0.00");
  assert.equal(formatMinorUnits(5, "AED"), "0.05");
  assert.equal(formatMinorUnits(99, "AED"), "0.99");
  assert.equal(formatMinorUnits(100, "AED"), "1.00");
  assert.equal(formatMinorUnits(123_456_789, "USD"), "1,234,567.89");
});

test("formatMinorUnits: 3-decimal and 0-decimal currencies", () => {
  assert.equal(formatMinorUnits(1_234_567, "KWD"), "1,234.567");
  assert.equal(formatMinorUnits(1_200_000, "JPY"), "1,200,000");
});

test("formatMinorUnits: negatives and rounding", () => {
  assert.equal(formatMinorUnits(-1_200_000, "AED"), "-12,000.00");
  assert.equal(formatMinorUnits(150.6, "AED"), "1.51"); // rounds to 151 minor units
});

test("formatMoney: prefixes currency code, falls back without one", () => {
  assert.equal(formatMoney(1_200_000, "AED"), "AED 12,000.00");
  assert.equal(formatMoney(1_200_000, "aed"), "AED 12,000.00");
  assert.equal(formatMoney(1_200_000, null), "12,000.00");
});

test("formatDate: ISO date and timestamp to fixed display", () => {
  assert.equal(formatDate("2024-06-30"), "30 Jun 2024");
  assert.equal(formatDate("2021-01-01T00:00:00.000Z"), "1 Jan 2021");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate("not-a-date"), "not-a-date");
});

test("formatTimestamp: UTC, no host timezone drift", () => {
  assert.equal(formatTimestamp("2024-06-30T14:05:09.000Z"), "30 Jun 2024, 14:05 UTC");
  assert.equal(formatTimestamp("2024-06-30"), "30 Jun 2024");
  assert.equal(formatTimestamp(null), "—");
});

test("formatTenure: years and months between dates", () => {
  assert.equal(formatTenure("2021-01-01", "2024-06-30"), "3 years, 5 months");
  assert.equal(formatTenure("2023-06-01", "2024-06-01"), "1 year, 0 months");
  assert.equal(formatTenure("2024-01-01", "2024-02-15"), "0 years, 1 month");
  assert.equal(formatTenure(null, "2024-06-30"), "—");
});

test("esc: escapes HTML-significant characters", () => {
  assert.equal(esc("<script>"), "&lt;script&gt;");
  assert.equal(esc('a & "b" \'c\''), "a &amp; &quot;b&quot; &#39;c&#39;");
  assert.equal(esc(null), "");
  assert.equal(esc(42), "42");
});

test("humanizeComponent: known and derived labels", () => {
  assert.equal(humanizeComponent("airTicket"), "Air Ticket");
  assert.equal(humanizeComponent("basic"), "Basic");
  assert.equal(humanizeComponent("housing_allowance"), "Housing Allowance");
});
