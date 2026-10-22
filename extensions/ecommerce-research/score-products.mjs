#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const REQUIRED = [
  "product",
  "category",
  "selling_price",
  "sourcing_cost",
  "shipping_cost",
  "platform_fee_pct",
  "return_rate_pct",
  "demand_score",
  "competition_score",
  "data_confidence",
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one product row.");

  const headers = rows[0].map((header) => header.trim());
  const missing = REQUIRED.filter((name) => !headers.includes(name));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);

  return rows.slice(1).map((cells, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, (cells[column] ?? "").trim()]));
    record._row = index + 2;
    return record;
  });
}

function numberField(record, name, min, max = Infinity) {
  const value = Number(record[name]);
  if (record[name] === "" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Row ${record._row}: ${name} must be a number from ${min} to ${max === Infinity ? "infinity" : max}.`);
  }
  return value;
}

export function rankProducts(records) {
  return records.map((record) => {
    const sellingPrice = numberField(record, "selling_price", 0.01);
    const sourcingCost = numberField(record, "sourcing_cost", 0);
    const shippingCost = numberField(record, "shipping_cost", 0);
    const feePct = numberField(record, "platform_fee_pct", 0, 100);
    const returnPct = numberField(record, "return_rate_pct", 0, 100);
    const demand = numberField(record, "demand_score", 0, 100);
    const competition = numberField(record, "competition_score", 0, 100);
    const confidence = numberField(record, "data_confidence", 0, 100);

    if (!record.product) throw new Error(`Row ${record._row}: product cannot be empty.`);

    const sourceUrl = (record.source_url ?? "").trim();
    const observedAt = (record.observed_at ?? "").trim();
    const evidenceNotes = (record.evidence_notes ?? "").trim();
    if (sourceUrl) {
      let parsedUrl;
      try {
        parsedUrl = new URL(sourceUrl);
      } catch {
        throw new Error(`Row ${record._row}: source_url must be a valid HTTP or HTTPS URL.`);
      }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error(`Row ${record._row}: source_url must use HTTP or HTTPS.`);
      }
    }
    if (observedAt && !/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) {
      throw new Error(`Row ${record._row}: observed_at must use YYYY-MM-DD format.`);
    }
    if (observedAt && (Number.isNaN(Date.parse(`${observedAt}T00:00:00Z`))
      || new Date(`${observedAt}T00:00:00Z`).toISOString().slice(0, 10) !== observedAt)) {
      throw new Error(`Row ${record._row}: observed_at must be a valid calendar date.`);
    }

    const platformFees = sellingPrice * feePct / 100;
    const returnRisk = sellingPrice * returnPct / 100;
    const contribution = sellingPrice - sourcingCost - shippingCost - platformFees - returnRisk;
    const marginPct = contribution / sellingPrice * 100;
    const marginScore = Math.max(0, Math.min(100, marginPct * 2));
    const score = marginScore * 0.35
      + demand * 0.30
      + (100 - competition) * 0.20
      + confidence * 0.15;

    return {
      product: record.product,
      category: record.category ?? "",
      source_url: sourceUrl,
      observed_at: observedAt,
      evidence_notes: evidenceNotes,
      selling_price: round(sellingPrice),
      estimated_contribution_inr: round(contribution),
      estimated_margin_pct: round(marginPct),
      demand_score: round(demand),
      competition_score: round(competition),
      data_confidence: round(confidence),
      opportunity_score: round(score),
      recommendation: contribution <= 0 ? "Review costs" : score >= 70 ? "Research first" : score >= 50 ? "Validate more" : "Low priority",
    };
  }).sort((a, b) => b.opportunity_score - a.opportunity_score);
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n") + "\n";
}

async function main() {
  const args = process.argv.slice(2);
  const inputPath = args.find((arg) => !arg.startsWith("--"));
  const outIndex = args.indexOf("--out");
  const outputPath = outIndex >= 0 ? args[outIndex + 1] : null;

  if (!inputPath || (outIndex >= 0 && !outputPath)) {
    console.error("Usage: node score-products.mjs <input.csv> [--out <report.csv>]");
    process.exitCode = 2;
    return;
  }

  try {
    const records = parseCsv(await readFile(inputPath, "utf8"));
    const ranked = rankProducts(records);
    if (outputPath) {
      await writeFile(outputPath, toCsv(ranked), "utf8");
      console.log(`Saved ${ranked.length} ranked products to ${outputPath}`);
    } else {
      console.table(ranked);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await main();
}
