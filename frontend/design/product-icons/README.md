# Product pictures (icons)

Every product picture is built from Microsoft's Fluent Emoji icons ("Color" style), MIT licence:
https://github.com/microsoft/fluentui-emoji. The original SVG files are in `svg/`, unchanged.
Each picture is turned into AVIF and WebP at 240 and 480 px with a transparent background.

## Files

- `svg/`: the Fluent Emoji SVGs used (one per icon name).
- `icons.mjs`: one entry per product key. `icon` is the main icon, `badge` a small icon in the
  corner that tells look-alike products apart (a snowflake for frozen, a fish on the tuna can),
  `count` and `mix` show several icons, `remap` recolours one colour range (green grapes, red
  peppers, salmon-coloured fish).
- `build.mjs`: renders everything to `out/products/` and writes `out/preview.png`.

Bulk and multipack sizes listed in `src/data/productImages.ts` get their own picture with two
or three copies of the icon (2 x 4 L milk shows two, a 2.27 kg bag shows three).

## Adding or changing a picture

1. Add or change the entry in `icons.mjs`. A new icon name needs its SVG in `svg/`, from
   `assets/<Name>/Color/<name>_color.svg` in the Fluent Emoji repository.
2. `npm install` then `npm run build` in this folder, and check `out/preview.png`.
3. Copy the files from `out/products/` to `public/images/products/`. A new product key also
   goes in `src/data/productImages.ts`.

`../product-images/` holds the earlier code-drawn pictures; they are no longer used.
