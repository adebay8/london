"""Enrich Dunelm TV-unit PDPs into normalised rows.

Dunelm embeds the whole product as JSON in an application/json script block:
a `features` array of property/value pairs (dimensions, composition, assembly,
storage layout, weight) plus a `skus` array carrying price and rating.
"""
import json, re, subprocess, sys, time

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

def fetch(url):
    r = subprocess.run(["curl", "-sL", "-m", "40", "-A", UA,
                        "-H", "Accept-Language: en-GB,en;q=0.9", url],
                       capture_output=True, text=True, errors="replace")
    return r.stdout or ""

def product_blob(html):
    for m in re.finditer(r'<script[^>]*type="application/json"[^>]*>(.*?)</script>', html, re.S):
        try:
            d = json.loads(m.group(1))
        except Exception:
            continue
        found = []
        def walk(o):
            if isinstance(o, dict):
                f = o.get("features")
                if isinstance(f, list) and f and isinstance(f[0], dict) and "property" in f[0]:
                    found.append(o)
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        walk(d)
        if found:
            return found[0]
    return None

def strip_html(s):
    return re.sub(r"<[^>]+>", "\n", s or "").replace("&amp;", "&")

NUM = r"(\d+(?:\.\d+)?)"

def axis(text, letter):
    m = re.search(rf"\b{letter}\s*{NUM}\s*cm", text, re.I)
    return float(m.group(1)) if m else None

def parse_dims(raw):
    """Overall H/W/D plus any 'Shelf n:' lines, each with whatever axes exist."""
    txt = strip_html(raw)
    lines = [l.strip() for l in txt.split("\n") if l.strip()]
    overall, shelves = {}, []
    for l in lines:
        if re.match(r"^(shelf|open shelf|compartment|cubby)", l, re.I):
            shelves.append({"w": axis(l, "W"), "h": axis(l, "H"), "d": axis(l, "D")})
        elif not overall and re.search(r"\bW\s*\d", l, re.I):
            overall = {"w": axis(l, "W"), "h": axis(l, "H"), "d": axis(l, "D")}
    return overall, shelves

def parse_storage(s):
    """'2 Shelves, 4 Doors, With Doors' -> counts per compartment kind."""
    out = {"open": 0, "door": 0, "drawer": 0}
    for n, word in re.findall(rf"{NUM}\s*(shelves|shelf|doors|door|drawers|drawer)", s or "", re.I):
        k = "open" if word.lower().startswith("shel") else "door" if word.lower().startswith("door") else "drawer"
        out[k] = max(out[k], int(float(n)))
    return out

def main(inp, outp):
    rows, seen = [], set()
    urls = [json.loads(l) for l in open(inp)]
    urls = [u for u in urls if u["retailer"] == "Dunelm"]
    for i, u in enumerate(urls, 1):
        html = fetch(u["url"])
        p = product_blob(html)
        if not p:
            print(f"  {i}/{len(urls)} NO BLOB {u['name'][:50]}", file=sys.stderr)
            continue
        feats = {f["property"]: f["value"] for f in p.get("features", [])}
        overall, shelves = parse_dims(feats.get("Product Dimensions", ""))
        if not overall.get("w"):
            print(f"  {i}/{len(urls)} NO DIMS  {u['name'][:50]}", file=sys.stderr)
            continue
        storage = parse_storage(feats.get("Storage Options", ""))
        skus = p.get("skus") or []
        instock = [s for s in skus if s.get("inStock")] or skus
        sku = instock[0] if instock else {}
        price = ((sku.get("price") or {}).get("now"))
        rating = sku.get("rating") or {}

        bays = []
        for sh in shelves:
            bays.append({"kind": "open", "count": 1, "widthCm": sh["w"], "depthCm": sh["d"], "heightCm": sh["h"]})
        extra_open = storage["open"] - len(shelves)
        if extra_open > 0:
            bays.append({"kind": "open", "count": extra_open, "widthCm": None, "depthCm": None, "heightCm": None})
        for k in ("door", "drawer"):
            if storage[k]:
                bays.append({"kind": k, "count": storage[k], "widthCm": None, "depthCm": None, "heightCm": None})

        key = p.get("productName")
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "retailer": "Dunelm", "brand": feats.get("Brand") or "Dunelm",
            "model": key, "product_url": u["url"],
            "colourway_shown": (sku.get("definingAttributes") or {}).get("colour"),
            "price_gbp": price,
            "delivery_cost_gbp": 12.95,  # Dunelm large-item delivery
            "landed_cost_gbp": round((price or 0) + 12.95, 2) if price else None,
            "arrives_assembled": "self" if re.search(r"flat pack|assembly required", feats.get("Assembly", ""), re.I) else "",
            "mounting": "wall-mounted" if re.search(r"wall", key or "", re.I) else "floor",
            "top_width_cm": overall.get("w"), "top_depth_cm": overall.get("d"),
            "overall_width_cm": overall.get("w"), "overall_depth_cm": overall.get("d"),
            "overall_height_cm": overall.get("h"),
            "bays_json": json.dumps(bays),
            "frame_material": feats.get("Composition"),
            "finish_material": feats.get("Finish"),
            "review_score": rating.get("averageRating"), "review_count": rating.get("totalCount"),
            "returns_window": "Free returns",
            "notes": f"Storage: {feats.get('Storage Options', 'not stated')}. Max TV {feats.get('Max TV Size', '?')}. Unit weight {feats.get('Weight Kg', '?')}.",
        })
        print(f"  {i}/{len(urls)} ok {overall.get('w')}x{overall.get('d')}cm  {key[:46]}", file=sys.stderr)
        time.sleep(0.35)
    with open(outp, "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    print(f"\nENRICHED {len(rows)}", file=sys.stderr)

main(sys.argv[1], sys.argv[2])
