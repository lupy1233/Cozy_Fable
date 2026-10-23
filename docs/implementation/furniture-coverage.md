# Furniture coverage and contract

P00.05 / P03–P05, 2026-09-15. Owner: furniture/layout agent.

| Questionnaire family | Current flow | Create/edit | Place/preview | JSON/save reader | Request/company path |
|---|---:|---|---|---|---|
| PIECE_BOOKCASE | 3 | Existing cabinet controls | Shared showroom renderer | Unchanged config | Existing v3 adapter |
| PIECE_WARDROBE | 3 | Existing cabinet controls | Shared showroom renderer | Unchanged config | Existing v3 adapter |
| PIECE_TV_UNIT | 3 | Existing cabinet controls | Shared showroom renderer | Unchanged config | Existing v3 adapter |
| PIECE_SHOE_CABINET | 3 | Existing cabinet controls | Shared showroom renderer | Unchanged config | Existing v3 adapter |
| PIECE_DRESSER | 3 | Existing cabinet controls | Shared showroom renderer | Unchanged config | Existing v3 adapter |
| PIECE_NIGHTSTAND | 3 | Existing cabinet controls | Shared showroom renderer | Unchanged config | Studio placement sends count ONE |
| PIECE_DESK | 3 | Existing cabinet controls | Shared showroom renderer | Unchanged config | Existing v3 adapter |
| PIECE_BED | 3, added | Dedicated size/storage/upholstery | Bed frame, headboard, mattress context | Typed bed options | Legacy quotation dimensions preserved |
| PIECE_TABLE | 3, added | Type/shape/seats/dimensions | Round pedestal or four legs; extension seam | Typed table options | Type/shape/dimensions/seats preserved |
| PIECE_BENCH | 3, added | Style/upholstered seat/width | Simple, storage, shoe shelf | Typed bench options | Style/seat/dimensions preserved |
| PIECES (other/custom) | 1 | Free-form questionnaire | No invented generic model | Existing answer reader | Text/files only; deliberate unsupported 3D family |
| Full-room questionnaires | Existing versions | Existing per-flow targets | Only explicitly configured 3D target pieces | Existing target configs | No assumption that every requested appliance/item is a 3D object |

All guided furniture families now have model/controls/preview/serialization adapters. This matrix records implementation routes, not a browser acceptance claim. Full room questionnaires still allow appliances, fixtures and free-text work beyond the ten furniture kinds; these are not automatically represented in the room model.

## Typed contract

Existing `PieceConfig3d` cabinet fields retain their interpretation. BED/TABLE/BENCH use empty columns plus exactly one typed family option object. Schema rejects cabinet controls on those families, mismatched family options, nonfinite dimensions, invalid shape/type pairs and a bed footprint inconsistent with its mattress size/upholstery.

Bed offers retain 90/140/160/180 cm mattress width and 200 cm length. The collision footprint includes the frame; it does not change ROOM_SIZE scoring. Mattress, pillows and throw are visual context only, never separate quotation items. Bed storage scoring retains NONE/LIFT_UP/DRAWERS. Table extension scoring retains its existing category/key.

Versions 1 and 2 of bed/table/bench flows remain frozen and registered; new requests start on version 3. No SQL columns/tables added. Studio format version handling is owned by P06 before enabling migrated account writes.

## Source/provenance

Inspected the user-designated local `F:/Cozy-Mobilaunicat` bed-config.ts and bed-model.ts for mattress/footprint separation and bed construction. No standalone license file was found in the source inventory. New target-specific model/config code was implemented around this application's existing questionnaire choices; the source's additional custom mattress lengths, drawer-side options, base types and footboards were not imported as unapproved product choices.

## Verification

- 109 focused tests pass: 52 existing geometry tests, 10 existing guided flow tests, 47 new family fixtures.
- New fixtures cover all 24 bed combinations, supported table pairs, bench styles/upholstery at width extremes, outer bounds, JSON round trips, invalid config rejection, legacy versions and two-nightstand quantity semantics.
- Shared typecheck passed.
- Browser contact sheet, reference screenshots, measured mobile GPU/frame/memory budgets and full publish/login/company journeys still require integrated QA. Do not mark those checklist gates complete from unit tests alone.

## Showroom resources

One shared panel/material component serves standalone, room and firm rendering. Soft geometry edges stay inside declared dimensions. Procedural wood/fabric treatment requires no image downloads and uses metric local coordinates. Rounded geometry is disposed on replacement/unmount; 3D remains demand-rendered. Cabinet opening/interior behavior is retained. Bed storage is represented closed; lift/drawer animation is not implemented in this phase.
