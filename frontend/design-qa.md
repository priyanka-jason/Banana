# Banana design QA — Locations

Final result: **passed**.

## Comparison target and evidence

- Selected source: `design/locations/01-split-view.png`, the first displayed
  concept selected by the user. Source pixels: 1487 × 1058.
- Production implementation: http://127.0.0.1:4173/#/locations.
- State: Mount Pleasant, 5 km radius, nearest first, Main Street selected.
- Final screenshot: `/tmp/banana-qa/locations-desktop.png`, 1440 × 1024 pixels,
  1440 × 1024 CSS pixels, device pixel ratio 1.
- Full comparison: `/tmp/banana-qa/locations-comparison.png`. The source was
  normalized to the same 1440 × 1024 viewport without changing its layout; the
  aspect ratios differ by less than 0.1 percent.
- Focused store/offer comparison: `/tmp/banana-qa/locations-offers-comparison.png`.
- Responsive evidence: `/tmp/banana-qa/locations-mobile.png` (390 × 958),
  `/tmp/banana-qa/locations-mobile-map.png` (390 × 958). Additional browser checks
  covered 320 × 800 and 768 × 1024 CSS pixels, without horizontal overflow.

The source and rendered screenshot were opened together in both full-screen and
focused comparison images. Earlier desktop evidence is retained at
`/tmp/banana-qa/locations-desktop-before.png`.

## Findings and repair history

- P1, map lifecycle: restyling could temporarily make `isStyleLoaded()` false
  after the load event, preventing the radius and origin marker from being added.
  The overlay now waits for the explicit load state and adds sources after style
  initialization. The production screenshot confirms the complete radius and
  origin marker. Resize handling refits the geographic radius to the viewport.
- P2, phone map: the initial panel height put store pins too far below the fold.
  Reduced height to account for the address controls and persistent navigation.
  The final phone map shows all three pins, attribution and navigation together.
- P2, radius label: the selected distance truncated on desktop. Adjusted its
  width and internal padding; the full label is visible in the final comparison.
- P2, offer previews: the initial implementation showed avocado instead of milk
  in the selected chain panel. The preview now pairs its first product with dairy
  when available, matching the selected source and reusing existing product data.
- P3, map palette and offer typography: softened geographic colors and roads,
  enlarged offer text and prices, and kept prices green in the compact panel.
- Accessibility: map-pin selection on phones now opens the list, scrolls the
  matching row into view, and focuses its store button. Verified in the production
  build: focus becomes “Collapse No Frills, Broadway”.

No actionable P0, P1 or P2 issues remain in the compared states.

## Fidelity surfaces

**Fonts and hierarchy.** Existing self-hosted DM Serif Display supplies the
Banana wordmark; DM Sans supplies all Locations text. The large Locations heading,
subheading, result count, branch identity and green prices follow the selected
hierarchy. Native controls and metadata remain readable at the tested widths.

**Layout and rhythm.** The desktop split remains approximately 44/56, with warm
search controls above white store rows, one pale yellow expanded store and a map
beside it. Thin dividers, restrained radii and minimal elevation follow the mock.
Tablet reflows the controls; phones use List/Map views and three-item bottom
navigation. The active search-origin line adds useful context above the rows.

**Color.** The app retains its warm background, dark forest text, yellow primary
actions and green prices. Provider map layers were adjusted toward the reference
palette, while retaining actual geography and required attribution.

**Images.** Existing transparent grocery WebP cutouts and authentic retailer
assets are reused; no new raster art was needed. The map is rendered by MapLibre
from real OpenFreeMap data, with library-native markers and geographic radius
geometry. It is not a flattened concept image or a hand-drawn map substitute.
Product imagery is sharp and correctly scaled; no broken images were observed.

**Copy and data.** Store coordinates and prices are explicitly sample data.
Distances are calculated from the illustrative points, so 0.9/1.4/2.2 km replace
conceptual 0.8/1.4/2.1 km. Milk remains a regular $5.19 offer, without the concept's
invented crossed-out price. Separate branches share brand offers. “Stock may
vary” avoids an inventory claim. Location and address lookup are real services.

## Functional checks

- Live BC address search, using Vancouver City Hall's public address, returned
  address choices in both development and production browser sessions.
- Selecting 453 W 12th Ave updates the origin; at 1 km only the illustrative No
  Frills branch remains, at 0.8 km. Browse items opens three No Frills offers with
  matching branch context and geographic distance. Back to locations works.
- Radius changes update list and map; Kitsilano at 1 km has no supported stores,
  and Expand to 10 km restores three. Nearest/name sorting and store expansion work.
- Phone List/Map switching and pin selection work, including focus restoration.
- Home/Locations navigation and the added third navigation item were exercised.
- Production browser warning/error logs were empty. A development-only Fast
  Refresh dependency-array warning occurred during editing; it did not recur in
  the fresh production session.
- Type checking, lint, formatting, nine Node tests, and production build passed.
  Tests cover geographic distances, radius boundaries, unknown brands, shared
  chain offers, circle geometry and catalogue branch linking as well as existing
  catalogue behaviour.

## Accepted differences and remaining test gaps

Actual map geography, attribution, marker shapes and zoom differ from the
illustrative source. Existing production branding and logos are preserved.
Browser location sharing is implemented, including denial and timeout messages,
but permission was not granted or exercised against the user's real location.
Network-failure recovery is implemented but was not forced through a browser
network outage. Safari and other browsers have not been tested.

MapLibre is lazy loaded separately; its map chunk still exceeds Vite's 500 KB
warning threshold (about 285 KB gzip, plus the map worker). This is accepted P3
performance follow-up, not a failed build. Public free-service availability and
policies may change. Store data and Supabase remain a later backend integration.

All changes are contained in `frontend/`. The earlier Home/Search design QA
passed before this extension; the existing catalogue tests remain passing.

## Annotation refinement — horizontal offers

The user requested a horizontal list in the expanded chain section and removal
of its shared-branches sentence. This overrides that part of the original mock.
The two offers now use compact image-and-text layouts in one horizontal strip,
with internal scrolling on narrow screens. The explanatory sentence was removed
from this section. Existing sample-data disclosures elsewhere remain.

Verified at 984 × 751 and 390 × 958 in the production preview: both offer actions
open their details, the strip scrolls on phones, and the page has no horizontal
overflow. Browser warning/error logs were empty. Type checking, lint, formatting
and the production build passed. Evidence:
`/tmp/banana-qa/locations-horizontal-offers.png` and
`/tmp/banana-qa/locations-horizontal-mobile.png`. Final result remains **passed**.
