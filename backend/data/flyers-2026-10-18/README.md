# Flyer data, Metro Vancouver, 2026-10-18

This folder holds sale-flyer prices read once from each grocery chain's public weekly flyer on 2026-10-18.
It is sale-flyer data only. Regular (non-sale) prices appear only where the flyer printed them, and none of the items below have one.

Nothing here is loaded into Supabase. The `backend/sql` folder was not touched.

## Result by chain

| Chain (slug) | Flyer read | Valid dates | Items |
|---|---|---|---|
| save-on-foods | Yes, image flyer, read from screenshots | Oct 15 to Oct 21, 2026 | 24 |
| no-frills | Yes, image flyer, read from screenshots, partial | Oct 15 to Oct 21, 2026 | 25 |
| real-canadian-superstore | Partly. Flyer shown too small to read prices reliably | Oct 15 to Oct 21, 2026 | 0 |
| walmart | No. Stopped at a bot check ("Robot or human?" press-and-hold) | Not read | 0 |
| costco | No. The flyer URL in the brief no longer exists, and the homepage has no grocery flyer | Not read | 0 |
| **Total** | | | **49** |

Source URLs:
- Save-On-Foods: https://www.saveonfoods.com/sm/planning/rsid/1982/circular (store 1982, not confirmed as the Cambie store)
- No Frills: https://www.nofrills.ca/en/print-flyer (store shown: Chris & Tanya's No Frills Renfrew, Vancouver)
- Real Canadian Superstore: https://www.realcanadiansuperstore.ca/en/print-flyer (store shown: Gerry Fitzgerald Drive)

## What stopped or was skipped

- **Walmart:** the site showed a "Robot or human?" press-and-hold check. I did not press it or try to get past it, and I did not retry. The store it showed was Richmond, not Vancouver. Changing the store needs an address form, which I did not fill in.
- **Costco:** https://www.costco.ca/warehouse-savings.html returned "Page not found". The Costco homepage showed only online appliance and electronics deals, with no grocery flyer. I did not browse product pages and did not use a membership.
- **Real Canadian Superstore:** the flyer was shown at a small scale, so most prices were too small to read reliably. The brief says to skip unreadable prices, so I recorded none.
- **No Frills:** a cookie banner covered the bottom of the flyer, and it offered no decline option, only "Close". I did not click it. I read the visible part of the flyer only, so the list is partial.
- **Save-On-Foods:** I read the flyer through its items screen by screen, but I skipped multi-buy deals ("2 for $X"), loyalty-only prices ("My Offers") and any item whose size or price was hard to read.
- **Cookie banners:** I did not accept any. Where a banner gave a decline option I would have used it; none was clicked.

## How the data is shaped

Each file is a list (JSON array) of items. Each item has the same field names as `RawItem` in `backend/src/types.ts`, with these differences:

- `chainSlug` and `scrapedAt` are added. `RawItem` has no chain field, and the brief asked for both.
- `salePriceCents` holds the flyer price, in whole cents (for example 149 = $1.49).
- `regularPriceCents` is left out, because none of the flyers printed one. The type requires it, so the loader will need to handle its absence.
- `storeCategories` is an empty list `[]` for most items, because flyers don't name categories. A few items have a rough category I assigned from the flyer's own layout.
- `unitLabel` holds what the flyer printed after the price, such as "per lb", "per 100 g" or "each".
- `sku` is "fly-" plus a kebab-case name, as the brief asked. It may not be unique across different sizes of the same product.
- `size` appears only when the flyer printed it.
- `saleStart` and `saleEnd` are the flyer's valid dates, 2026-10-15 to 2026-10-21.

## Known limits

- Reading prices from screenshots can misread small print. Items were included only when name and price were clear.
- The total is far below the 300 target. The flyers are long image pages, and reading them by screenshot is slow. Walmart and Costco gave no usable data, and Superstore gave almost none.
