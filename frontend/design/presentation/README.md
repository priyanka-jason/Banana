# Banana design review

The presentation includes all six visual styles from the two exploration rounds.
Each style has a Home page and a Search items page, each with desktop and phone views.
The final PDF is `../../output/pdf/banana-design-review.pdf` (14 pages).

## Style order

1. Sunny Market
2. Daily Ledger
3. Neighbourhood Fresh
4. Sunshine Pop
5. Swiss Grocery Index
6. Neighbourhood Pantry

## Source assets

Each original board contains desktop Home and phone All items.
Each companion board contains desktop Search items and phone Home.
The PDF places the matching screen regions together using PDF clipping;
original image files are retained without resizing or modification.
“All items” and “Search items” refer to the same catalogue experience.

The images were created with built-in image generation. The companion prompt
for each style asked to preserve its reference typography, palette, imagery,
and navigation while adding the missing desktop search and phone home views.
Search concepts include category, store, distance, discounts-only and price
sorting controls. All prices, distances, and dates are illustrative mock data.
The design brief is grocery-only discovery in Vancouver, daily price updates,
image slots, responsive web views, and a future Supabase backend.

## Rebuild

`build_pdf.py` requires Python with reportlab and Pillow, plus the macOS system Arial fonts used for embedded PDF headings. These are presentation
tools, not frontend runtime dependencies. Run it from any directory; it reads
`styles.json` and `assets/`, and writes the PDF under `frontend/output/pdf/`.
