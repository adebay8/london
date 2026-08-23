# sofa CSV column contract

One row per model/configuration. Header, exactly:

retailer,brand,model,product_url,image_url,colourway_shown,price_gbp,rrp_gbp,delivery_cost_gbp,landed_cost_gbp,over_budget,condition,one_off,seats,leg_rest,chaise_side,modular,overall_width_cm,overall_depth_cm,overall_height_cm,seat_depth_cm,seat_height_cm,arm_style,fabric,easy_clean,removable_covers,seat_filling,frame_material,warranty,returns_window,delivery_lead_time,review_score,review_count,notes

Rules:
- Leave a cell EMPTY when the retailer does not publish it. NEVER guess a
  dimension. Empty means "unpublished" and the app handles it correctly;
  a guessed number silently corrupts the ranking.
- `landed_cost_gbp` = price + delivery. If delivery is free/included, put
  "included" in delivery_cost_gbp and landed = price.
- `condition`: new | ex-display | clearance | second-hand
- `one_off`: yes when the stock cannot be reordered (most ex-display, all
  second-hand)
- `leg_rest`: chaise | footstool | both | none
- `chaise_side`: left | right | reversible   (as you look at the sofa)
- `modular`: yes | no
- `seat_filling`: feather | feather-blend | foam | fibre | mixed
- `easy_clean`, `removable_covers`: yes | no
- overall_depth_cm is the FULL front-to-back depth; seat_depth_cm is the
  usable seat only. They are different numbers — do not put one in the other's
  column.
