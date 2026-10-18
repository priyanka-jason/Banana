# Product pictures

Flat illustrations for every product, drawn in code (no photos, no store artwork), so there
is nothing to license or credit. Each picture is an SVG drawing turned into AVIF and WebP at
240 and 480 px with a transparent background, about 2 to 7 KB each.

Sizes are realistic within each family: items in the same `group` share one scale (pixels
per centimetre), so a 2 L jug is narrower than a 4 L jug, a 9 kg sack is bigger than a
4.5 kg bag, and multipacks show the real count (2 x 4 L, 8 x 170 g, 40 rolls). Very small
items are enlarged a little (at least 55% of the frame) so they stay readable; they still
look smaller than their bulk versions.

## Files

- `shapes.mjs`: the drawing kit (jug, carton, bottle, can, bag, box, tray, produce...).
- `items.mjs`: one entry per picture: product key, pack size, family, real size in cm.
- `build.mjs`: renders everything to `out/products/`, writes `out/manifest.json` and a
  `out/preview.png` contact sheet.

## Adding or changing a picture

1. Add an entry in `items.mjs` (the key is the product's sku without `sim-`; mark the
   regular size with `true` as the last argument, other sizes become `<key>--<size>`).
2. `npm install` then `npm run build` in this folder, and check `out/preview.png`.
3. Copy the new files from `out/products/` to `public/images/products/`, and add the key
   (and size, if it's a bulk version) to `src/data/productImages.ts`.

Pictures for "per kg" bulk meat are not used on the site: other chains also price by the kg,
so a size-only lookup would show the bulk tray for them.
