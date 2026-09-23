# sofa bed CSV column contract

One row per model/configuration. Header, exactly:

retailer,brand,model,product_url,image_url,colourway_shown,price_gbp,rrp_gbp,delivery_cost_gbp,landed_cost_gbp,over_budget,condition,one_off,in_stock,seats,seat_cushions,mechanism,separate_mattress,bed_width_cm,bed_length_cm,mattress_type,mattress_thickness_cm,bedding_storage,leg_rest,chaise_side,modular,overall_width_cm,overall_depth_cm,overall_height_cm,extended_depth_cm,seat_depth_cm,seat_height_cm,arm_style,fabric,easy_clean,removable_covers,seat_filling,frame_material,warranty,returns_window,delivery_lead_time,review_score,review_count,notes

Rules:
- Leave a cell EMPTY when the retailer does not publish it. NEVER guess a
  dimension. Empty means "unpublished" and the app handles it correctly;
  a guessed number silently corrupts the ranking.
- `landed_cost_gbp` = price + delivery. If delivery is free/included, put
  "included" in delivery_cost_gbp and landed = price.
- `condition`: new | ex-display | clearance | second-hand
- `one_off`: yes when the stock cannot be reordered (most ex-display, all
  second-hand)
- `seats` is how many PEOPLE it seats. `seat_cushions` is how many cushions
  span that width. They are different numbers and both are wanted — two
  cushions across a 3-seat width is the look being searched for.
- `mechanism`: fold-out | pull-out | click-clack | futon
- `separate_mattress`: yes when a mattress is stored inside the frame and you
  do NOT sleep on the seat cushions; no when the seat IS the sleeping surface.
  **Leave EMPTY when the listing does not make this unambiguous.** Do not
  infer it from the product name — this is the single field the ranking leans
  on hardest, and a guess corrupts it.
- `bed_width_cm` is the width of the bed when open; `bed_length_cm` is its
  length. A UK double is 135 x 190. Putting 190 in the width column is the
  most common error in this corpus — check which way round you have it.
- `mattress_type`: pocket-sprung | sprung | memory | foam | fibre
- `mattress_thickness_cm`: the mattress only, not the folded sofa.
- `bedding_storage`: yes when there is a compartment for duvet and pillows.
- `leg_rest`: chaise | storage-chaise | footstool | both | none
  (`storage-chaise` = a chaise that lifts to store bedding)
- `chaise_side`: left | right | reversible  (as you look at the sofa)
- `modular`, `easy_clean`, `removable_covers`: yes | no
- `seat_filling`: feather | feather-blend | foam | fibre | mixed
- `overall_depth_cm` is the FULL front-to-back depth when CLOSED.
  `extended_depth_cm` is how far it reaches into the room when OPEN.
  `seat_depth_cm` is the usable seat only. Three different numbers — do not
  put one in another's column.
- SECOND-HAND ROWS: a used sofa bed comes with a used MATTRESS, which is a
  different proposition from a used sofa. In `notes`, say whether the mattress
  is included and what condition it is in. Replacing one is a real cost and the
  buyer needs it priced in, not discovered on collection day.
