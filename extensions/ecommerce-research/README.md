# E-commerce Product Research Toolkit

A dependency-free Node.js toolkit for ranking product opportunities from a CSV research sheet. It is designed as an initial, local-first extension for the AI Employees repository. It does not scrape marketplaces, call paid APIs, or claim that sample data represents live demand.

## Requirements

- Node.js 18 or newer
- A CSV file with the columns shown in `sample-products.csv`

## Run

From the repository root:

```bash
node extensions/ecommerce-research/score-products.mjs extensions/ecommerce-research/sample-products.csv
node extensions/ecommerce-research/test.mjs
```

To save a ranked CSV report:

```bash
node extensions/ecommerce-research/score-products.mjs input.csv --out ranked-products.csv
```

## Input fields

- `product`: product name
- `category`: category label
- `selling_price`: expected selling price in INR
- `sourcing_cost`: unit purchase cost in INR
- `shipping_cost`: estimated per-unit shipping and fulfilment cost in INR
- `platform_fee_pct`: estimated marketplace/payment fees as a percentage of selling price
- `return_rate_pct`: estimated return or refund rate percentage
- `demand_score`: manually researched demand signal from 0 to 100
- `competition_score`: competition intensity from 0 to 100, where higher means more competition
- `data_confidence`: confidence in the evidence from 0 to 100

The scores are research prioritization aids, not forecasts or guarantees. Keep the source URL and observation date in your research notes before making a purchasing decision.

## Ranking method

The toolkit calculates estimated contribution after sourcing cost, shipping, platform fees and a simple return-risk allowance. It then combines normalized margin, demand, inverse competition and evidence confidence into a 0 to 100 opportunity score. Products with missing, invalid or non-positive selling prices are rejected instead of silently ranked.

The return-risk allowance is a simple sensitivity estimate: selling price multiplied by return rate. Actual costs can differ materially by category, seller policy, GST treatment, logistics and marketplace.

## Safe use

- The included rows are fictional examples.
- Replace estimates with sourced, dated observations.
- Do not automatically purchase inventory, publish listings, send messages or spend advertising budget based on this score.
- Marketplace scraping must respect each site's terms, access controls and rate limits.
