# Basket comparison: frontend → backend handoff

October 17, 2026. Requested behavior is approved; no new database is required.

## Product behavior

A customer builds one store-independent list of requested products and quantities. Opening My list shows whole-basket totals across chains, sorted by total within each comparison group. The original requested basket always remains visible. Choosing an option is explicit and never silently changes the requested products or quantities.

1. Exact products, package sizes, pack counts and requested quantities are the primary comparison. Two 2 L cartons must remain distinct from one 4 L jug or one multipack.
2. Show separately labelled packaging/quantity alternatives, both within the same chain and at other chains. Include requested versus supplied quantities, whole packs purchased, any extra amount, changed lines and the full basket total. Do not hide exact options because another package is cheaper.
3. Identical packages added from different chains merge into one requested line; quantities add. The chosen store is a purchase preference, not product identity.
4. For a mixed-store list, consolidate identical packages at the first/chosen chain where possible. If unavailable, retain a clearly labelled split-store basket. Never claim an incomplete subtotal is the cheapest full basket.
5. Missing items are explicit. Incomplete chains are excluded from complete-basket rankings. A split-store exact-match option may be offered, with every store named.
6. No invented prices, product matches, membership assumptions, expiry dates or inventory. Existing prices are simulated in Supabase and remain labelled. Product images remain frontend assets.

## Existing support inspected

`backend/sql/migrations/002_browser_reads.sql` defines the read-only `banana.price_shopping_list` RPC. It supports quantity or physical amount, per-chain totals, whole-pack rounding, missing indexes, nearest branches and a cheapest mixed-store basket. The function was successfully called live with the publishable key using a sample 8 L 2% milk request.

Important limitations:

- `itemId` is chain-specific, so it prevents cross-chain identical-product comparison.
- `query` is a broad text search; it can match unrelated brands/variants or package sizes. It is not an exact product contract.
- It chooses the cheapest match per chain per line and does not preserve a separate exact-package baseline plus alternatives.
- Internal `search_offers` uses a limit of 100. A larger matching set can silently omit a valid chain/product. The per-entry output also caps matches.
- The RPC does not return a stable shared variant identity, explicit substitution type, supplied total amount or overbuy delta for each chosen line.

Do not use a fuzzy query such as `milk` to assert that milk brands/fat percentages/dietary variants are identical.

## Frontend implementation now

The frontend compares the bounded current Supabase catalogue locally, reusing actual prices and size metadata; it does not seed data or change the database. It retains the existing snapshot guardrail and refresh/error handling.

Trusted exact identity uses a backend `comparison_group_id` when available, or a shared UPC for identical packages. For the existing **simulated dataset only**, documented shared `sim-*` SKUs plus variant name/brand identify demo products; size metadata and pack count distinguish packages. Packaging alternatives require a verified variant group and compatible unit metadata. Unknown real-world products are not matched by name alone; the UI explains that matching data is needed.

The shopping list remains in browser storage for now. User requests and selected purchase options are separate so choosing a different pack never overwrites the original request. This is not account-synced list storage or live stock confirmation.

## Backend additions requested

### 1. Stable variant identity

Add a nullable indexed `comparison_group_id` to `banana.products` (or an equivalent normalized variant table with a stable exposed key). It identifies the same brand, item, variant, flavour, fat percentage and dietary form across chains while allowing different package sizes. Keep UPC/SKU as source identifiers; do not assume chain SKUs are globally shared for real data.

Continue exposing `brand`, `upc`, `pack_count`, `size_kind`, `size_unit`, `size_total_base`, `priced_by_weight` and size display text. Null or ambiguous metadata must stay unknown, not be inferred into an asserted exact match. Define a stable package key if metadata alone cannot capture packaging differences.

### 2. Safe comparison RPC

Prefer a new read-only `banana.compare_basket` RPC so existing clients of `price_shopping_list` are not broken. Proposed input:

```json
{
  "p_items": [
    {
      "line_id": "line-1",
      "reference_offer_id": "save-on-foods:sim-milk-2-4l",
      "quantity": 2
    }
  ],
  "p_preferred_chain": "save-on-foods",
  "p_chain_slugs": null,
  "p_allow_packaging_alternatives": true
}
```

The reference offer defines the requested exact variant/package; its chain must not constrain the match. If reference offers disappear, support a persisted verified variant/package identity or return an explicit unresolved-line error. Keep location optional; when supplied, use rounded coordinates in a POST body, radius filtering and only chains with offers. Do not persist or log visitor locations as part of comparison.

Return separate `exact_baskets`, `packaging_alternatives`, `incomplete_baskets` and `exact_split_basket`, plus unresolved matching metadata. Each plan needs a stable ID, all chain identities, complete/missing status, integer-CAD-cent total, line picks and price timestamps. Each pick needs:

- original `line_id`, selected offer/product ID, chain and verified variant ID;
- requested package/quantity/total amount and unit;
- purchased packages, pack size, supplied amount, extra amount and unit;
- unit price cents, line total cents and substitution reason;
- `exact`, `different_package_same_amount` or `different_quantity` classification.

Sort complete plans by whole-basket total with deterministic tie-breaking. Never count partial totals as complete totals. Return a lower-cost same-chain packaging plan when available, without replacing that chain's exact plan. No fractional fixed packs; loose weighted goods require explicitly defined weight semantics. Use a consistent Vancouver business date and respect active sale dates; member-only pricing requires an explicit membership choice. Totals exclude travel/tax unless those are implemented and clearly identified.

Do not silently truncate candidates before matching or optimizing a basket. Report any limit/error rather than claiming an exhaustive cheapest result. Keep existing RLS and anonymous read-only permissions; no service-role key in the browser.

### 3. Test cases required

- Same product/package at multiple chains merges into one basket line; different variants do not.
- Two 2 L packs stay in exact results while one 4 L pack appears separately; same-chain and cross-chain alternatives both appear.
- Different multipack counts are not exact packages even when total volume matches.
- Whole packs can supply extra quantity, which is explicitly returned, never hidden.
- Incomplete low subtotals never outrank a complete basket; missing indexes are correct.
- Missing reference item/identity/size/price does not produce a name-only substitute or zero-cost basket.
- Mixed-store requests consolidate safely, with an explicit split when a chain lacks a requested item.
- Expired sales, quantities, currency rounding and ties are deterministic.
- Anonymous reads work, writes/private-list access remain denied.

## Handoff response

Please confirm the canonical identity fields and final RPC request/response before frontend switches from the bounded catalogue implementation. Return migrations, deployed RPC status, sample exact and alternative responses, and tests. Do not send administrative credentials. Keep all changes additive and preserve the existing ingestion pipeline.
