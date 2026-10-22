import assert from "node:assert/strict";
import { rankProducts } from "./score-products.mjs";

const products = [
  {
    _row: 2, product: "Low margin", category: "test", selling_price: "100",
    sourcing_cost: "90", shipping_cost: "15", platform_fee_pct: "10",
    return_rate_pct: "5", demand_score: "90", competition_score: "20", data_confidence: "90",
  },
  {
    _row: 3, product: "Healthy margin", category: "test", selling_price: "500",
    sourcing_cost: "150", shipping_cost: "40", platform_fee_pct: "10",
    return_rate_pct: "4", demand_score: "75", competition_score: "40", data_confidence: "80",
  },
];

const ranked = rankProducts(products);
assert.equal(ranked.length, 2);
assert.equal(ranked[0].product, "Healthy margin");
assert.equal(ranked[0].estimated_contribution_inr, 240);
assert.equal(ranked[0].estimated_margin_pct, 48);
assert.equal(ranked[0].source_url, "");
assert.equal(ranked[0].observed_at, "");
assert.equal(ranked[0].evidence_notes, "");
assert.ok(ranked[0].opportunity_score > ranked[1].opportunity_score);

const sourced = rankProducts([{
  ...products[1],
  source_url: "https://example.com/product-evidence",
  observed_at: "2026-10-20",
  evidence_notes: "Fictional test evidence",
}])[0];
assert.equal(sourced.source_url, "https://example.com/product-evidence");
assert.equal(sourced.observed_at, "2026-10-20");
assert.equal(sourced.evidence_notes, "Fictional test evidence");
assert.equal(ranked[1].recommendation, "Review costs");

assert.throws(
  () => rankProducts([{ ...products[0], selling_price: "0" }]),
  /selling_price must be a number/,
);
assert.throws(
  () => rankProducts([{ ...products[0], demand_score: "101" }]),
  /demand_score must be a number/,
);
assert.throws(
  () => rankProducts([{ ...products[0], source_url: "javascript:alert(1)" }]),
  /source_url must use HTTP or HTTPS/,
);
assert.throws(
  () => rankProducts([{ ...products[0], observed_at: "20-10-2026" }]),
  /observed_at must use YYYY-MM-DD format/,
);
assert.throws(
  () => rankProducts([{ ...products[0], observed_at: "2026-02-31" }]),
  /observed_at must be a valid calendar date/,
);

console.log("E-commerce research tests passed.");
