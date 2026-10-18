# Banana frontend design QA

Final result: **passed** (2026-10-17).

## References and evidence

- Approved Home: `design/merged/home-v2.png`.
- Approved catalogue: `design/merged/search-items-v1.png`.
- Live implementation: http://127.0.0.1:5173/.
- Final viewport screenshots: `/tmp/banana-qa/home-desktop.png`,
  `/tmp/banana-qa/home-mobile.png`, `/tmp/banana-qa/search-desktop.png`,
  `/tmp/banana-qa/search-mobile.png`.
- Direct source/render comparisons: `/tmp/banana-qa/compare-desktop.png`,
  `/tmp/banana-qa/compare-mobile.png`, `/tmp/banana-qa/compare-header.png`.
- Tablet catalogue evidence: `/tmp/banana-qa/search-tablet.png`.

Desktop screenshots use 1240 × 958 CSS pixels; phone screenshots use 390 × 958,
with additional checks at 320 × 800 and 768 × 1024. Source board regions were
cropped to their desktop and phone boundaries and compared beside rendered
screens at matching dimensions. Header and hero were also compared in a focused
crop. Temporary evidence remains outside the repository as required.

## Visual review

The quiet warm upper Home region, serif Banana wordmark and two-line hero,
right-aligned desktop search, white product grid, green prices, yellow actions,
search table, and mobile list preserve the approved hierarchy. DM Serif Display
is reserved for branding and the Home headline. DM Sans supplies headings,
controls, product names and metadata. Fonts are self-hosted. Controls have visible
focus states and phone actions have generous touch targets.

Product cutouts are standalone transparent WebP assets, not flattened page
screenshots. Images load without broken requests. Original PNG assets are kept
in the design folder. Retailer identities use existing logo assets. Product
names, pack sizes, CAD prices, unit prices, distances and expiry are visible;
sample data and its fixed update timestamp are explicitly identified.

Intentional adaptations: the catalogue includes eight illustrative offers rather
than four, allowing comparisons and meaningful filters; actual retailer marks
replace approximate generated marks; generated grocery photo poses vary slightly;
the location label is shortened on phones; the search header uses the same warm
brand treatment as Home. Native select menus follow the browser/platform style.
These differences preserve the selected design and functionality.

## Review and repair history

- P2: initial hero type was too small. Enlarged the desktop headline and balanced
  the phone headline against the wordmark and sans serif controls.
- P2: excessive phone image-slot height pushed core prices and actions down.
  Reduced image-slot height and section spacing, then rechecked source/render.
- P2: tablet filters truncated selected labels. Reflowed filters into a three-column
  layout with sorting on a second row; verified the 768-pixel rendering.
- P2: asynchronous hash updates briefly conflicted with controlled filter values.
  Navigation now publishes route updates synchronously; filtering and history
  were retested.
- P3: product artwork and store marks lacked consistent scale. Adjusted image
  scaling, replaced compact store symbols, and regenerated the egg carton.
- P3: secondary metadata was too faint. Darkened it and adjusted phone text sizes.

Final inspection found no unresolved P0, P1 or P2 issues, horizontal overflow,
clipped primary controls, overlapping content, or broken images in the tested
views. Small photographic differences from the concept are accepted.

## Functional verification

Browser checks covered Home search, live catalogue search, category/store/radius
and discount combinations, all sort choices, reset and empty results, location
changes, browser Back/Forward, offer details and Escape dismissal. Mobile filter
changes apply together; dismissing the sheet with Escape discards draft changes.
The 320-pixel Home fits without horizontal scrolling. Browser warning/error logs
were empty in the final run.

Five catalogue tests cover filter parsing, combined filtering, search, sorting,
and distance/discount behaviour. Type checking, lint, formatting checks and the
production build are required before handoff.

## Integration boundary

All implementation is inside `frontend/`. There is no Supabase connection yet.
Location distances, prices, freshness and expiry are mock data. Offer details
link to retailer websites; no live flyer URL or current stock claim is implied.
