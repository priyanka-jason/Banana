# Locations design exploration

Three desktop concepts generated with the built-in Image Gen tool, grounded in
Banana's live Home screenshot. These are visual mockups, not implemented screens.
The generated maps, branch locations, logos and prices are illustrative and must
be replaced with verified store records and existing production logo assets.

## Accepted brief

- Grocery only, Vancouver launch.
- Third navigation destination: Locations.
- Manual address search or user-initiated location sharing.
- Simple straight-line distance radius; 5 km shown in the examples.
- Show only store branches whose brand has item data.
- Branches remain separate locations and share brand-level offers.
- Offers do not imply confirmed branch inventory.
- Free services only; no paid fallback or billing-enabled map dependency.
- Existing serif Banana wordmark, sans serif UI, warm header, yellow actions.

## Concepts and prompt direction

1. `01-split-view.png`: nearby store list on the left, illustrative map on the
   right; selected store expands to show two brand offers.
2. `02-store-offers-list.png`: list-first view with brand/branch information
   alongside two compact grocery offers; optional Map toggle.
3. `03-map-store-inspector.png`: dominant map with a selected-store details panel
   and related offers on the right.

All prompts specified one desktop frame at 1440 × 1024, readable 14–16 px body
text, realistic spacing, thin dividers, restrained yellow, no decorative banana
hero, no invented stock claims, ratings, opening hours or travel times. Each
received the existing live screenshot as its visual reference and used sample
CAD data anchored to October 17, 2026.

## Free-service research

OpenFreeMap currently offers free hosted map tiles, commercial use and no API
key requirement: https://openfreemap.org/ . Attribution is required and the public
service does not promise an SLA. MapLibre can render these maps.

Address lookup is a separate dependency. BC's public Address Geocoder supports
address matching and autocomplete, but its current access/CORS requirements and
terms must be verified before integration:
https://github.com/bcgov/api-specs/blob/master/geocoder/geocoder-developer-guide.md

Do not substitute the public Nominatim endpoint for address autocomplete; its
usage policy prohibits that behaviour:
https://operations.osmfoundation.org/policies/nominatim/

The store list should remain usable if map display fails. No provider has been
integrated and no credentials or live user location have been requested.
