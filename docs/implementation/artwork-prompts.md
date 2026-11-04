# Original showroom artwork

Generated with the built-in image-generation tool, not the API/CLI fallback. Selected original outputs copied unchanged into `apps/frontend/public/illustrations/`; original generation files remain in Codex generated_images. Existing material/opening assets were preserved as style references.

Shared final prompt specification: square opaque-white 4-by-4 atlas, exactly sixteen row-major objects with no text/grid/logo, generous equal-cell margins, three-quarter showroom rendering, pale oak/warm white matte/neutral upholstery, soft neutral gray shadows, clear mechanisms. The furniture atlas is the style/layout reference for the other two. White is intentional; CSS multiply blends it with the answer cards. No raster re-encoding or pixel manipulation was used.

- `showroom-furniture.png`: wardrobe, bed, nightstand, dresser / TV unit, bookcase, desk, dining table / coffee table, console table, shoe cabinet, bench / coat unit, mirror shelf, vanity table, glass display. Selected opaque-white revision; rejected earlier fringe-producing transparency variant was not copied.
- `showroom-appliances.png`: base kitchen cabinet, wall cabinet, tall pantry, island / oven, induction hob, cooker hood, open dishwasher / refrigerator, microwave, sink vanity, mirror cabinet / tall bathroom storage, washer, stacked washer/dryer, side-by-side washer/dryer.
- `showroom-configurations.png`: lift-up bed, drawer bed, upholstered bed, wardrobe hanging rod / open shelves, shoe rack, pull-out accessory tray, illuminated shelf / closed cabinet, mixed open/closed storage, storage bench, shoe bench / round table, extending table with visible leaf, drawer pedestal, desk with cable grommet.

Final prompts required each object remain entirely in its own cell, distinct without labels, with no room scenes, logos, colored fringes or extraneous props. B/C were explicitly generated as new subjects using the selected furniture atlas only as style/grid reference. Requested 2048-square; actual returned files are 1254-square. CSS percentage crops do not assume 2048px.

Visual checks: original full atlases inspected; all sixteen subjects per atlas matched the required order. App-size inspection uses `docs/showroom-artwork-contact-sheet.html` and browser screenshots. Functional diagrams (sizes, layouts, counts and movement) remain intentional exceptions documented in `docs/experience-adaptation-and-artwork.md`.
