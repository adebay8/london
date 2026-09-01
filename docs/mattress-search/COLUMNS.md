# mattress CSV column contract

One row per model at **double (135 x 190)**. Header, exactly:

retailer,brand,model,product_url,image_url,price_gbp,rrp_gbp,rrp_evidence,price_floor_gbp,delivery_cost_gbp,disposal_cost_gbp,landed_cost_gbp,over_budget,condition,in_stock,size,width_cm,length_cm,depth_cm,type,spring_type,spring_count,zoned,turn_required,firmness_label,firmness_scale,firmness,comfort_layer,comfort_layer_depth_cm,weight_kg,slatted_base_ok,platform_base_ok,ottoman_ok,cover_removable,cover_washable,trial_nights,trial_free_returns,warranty_years,returns_window,delivery_lead_time,review_score,review_count,tested_by,test_score,notes

## The rule that matters most

Leave a cell **EMPTY** when the retailer does not publish it. NEVER guess.
Empty means "unpublished" and the app handles it correctly — the criterion is
dropped from the average and the score is shrunk toward the corpus median. A
guessed number silently corrupts the ranking and cannot be told from a real one
later.

This bites hardest on `weight_kg` and `firmness`. Most listings publish
neither. That is fine, and it is why bed compatibility is a badge rather than a
filter.

## Money

- `landed_cost_gbp` = price + delivery + disposal. If delivery is
  free/included, put `included` in `delivery_cost_gbp` and landed = price.
- `disposal_cost_gbp` — what the retailer charges to take the old mattress
  away. Empty if not offered; `included` if free.

## The "was" price — read this before filling in `rrp_gbp`

Mattress RRPs are the least trustworthy numbers in UK retail. Record what the
listing claims, then record how much it can be believed:

- `rrp_evidence: verified-higher` — you have SEEN it sold at the higher price
  (an archived listing, a price tracker, a different retailer at full price).
  Only use this with evidence you could point at.
- `rrp_evidence: permanent-sale` — the "sale" price is the only price it has.
  Signals: a countdown that resets, "sale ends" dates that keep moving, the
  same discount on every size and colour all year, a brand that has never been
  seen at RRP.
- `rrp_evidence: single-observation` — one price check, no way to tell yet.
  **This is the default.** A first pass over a retailer can honestly say
  nothing more.

`price_floor_gbp` — the lowest price actually observed. On a first run this
equals `price_gbp`. It only becomes useful on the second run, and that is the
point: the guard gets teeth from repetition, not from a single scrape.

The app never scores the discount. See `lib/mattresses/deal.ts`.

## Enumerations

- `condition`: `new` | `clearance`. **Nothing else is in scope** — no
  second-hand, no ex-display floor models.
- `type`: `pocket-sprung` | `hybrid` | `memory-foam` | `foam` | `open-coil` |
  `latex` | `natural`
- `spring_type`: `pocket` | `open-coil` | `continuous` | `none`
- `firmness`: `soft` | `medium-soft` | `medium` | `medium-firm` | `firm`

## Firmness — do not normalise silently

Three columns, and they do different jobs:

- `firmness_label` — the retailer's own words, **verbatim**. "Medium", "Firm
  support", "7 out of 10". Always fill this in when anything is published.
- `firmness_scale` — the scale those words sit on, where one is given, e.g.
  `1-10 (Emma)`.
- `firmness` — our five-point bucket. Fill this in **only** where the wording
  maps unambiguously. Leave it empty for "orthopaedic", "supportive",
  "luxury", "posture" — those words carry no firmness information, and reading
  them as firm is how a side sleeper ends up on a board.

A brand's "medium-firm" is not another brand's "medium-firm". The label is
kept so the reader can see the original wording rather than trusting ours.

## Booleans

`yes` / `no`, or empty for unpublished. Applies to `in_stock`, `zoned`,
`turn_required`, `slatted_base_ok`, `platform_base_ok`, `ottoman_ok`,
`cover_removable`, `cover_washable`, `trial_free_returns`, `over_budget`.

`slatted_base_ok` / `platform_base_ok` / `ottoman_ok` come from the retailer's
own base-suitability statement. Do not infer one from another.

## Spring count

Record what is published, for the DOUBLE. If the listing gives a count for a
king, leave it empty rather than scaling it — a scaled count is a guess.

The app deliberately saturates this criterion: past ~2,000 in a double, extra
springs mean thinner wire, not better support.

## Trial

`trial_nights` is the sleep trial, not the returns window. They are different
things and retailers mix them up: a 14-day returns policy on an unopened box is
not a trial. If only a returns policy exists, fill `returns_window` and leave
`trial_nights` empty.

## Independent tests

`tested_by` / `test_score` are for testers with no stake in the sale — Which?,
Good Housekeeping. Not the retailer's own "9.4 sleep score".
