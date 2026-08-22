"""Enrich PDPs from retailers whose product JSON-LD (or page text) carries
dimensions. One extractor with per-retailer hooks, because the shapes differ
but the fields wanted are the same.
"""
import json, re, subprocess, sys, time

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
NUM = r"(\d+(?:\.\d+)?)"

def fetch(url):
    r = subprocess.run(["curl", "-sL", "-m", "40", "-A", UA,
                        "-H", "Accept-Language: en-GB,en;q=0.9", url],
                       capture_output=True, text=True, errors="replace")
    return r.stdout or ""

def ld_products(html):
    out = []
    for m in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
        try:
            d = json.loads(m.group(1).strip())
        except Exception:
            continue
        def walk(o):
            if isinstance(o, dict):
                t = o.get("@type")
                ts = t if isinstance(t, list) else [t]
                if "Product" in ts and o.get("name"):
                    out.append(o)
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        walk(d)
    return out

def f(v):
    try:
        return float(re.sub(r"[^\d.]", "", str(v)))
    except Exception:
        return None

def price_of(p):
    o = p.get("offers")
    if isinstance(o, list):
        o = o[0] if o else {}
    return f((o or {}).get("price") or (o or {}).get("lowPrice")) if isinstance(o, dict) else None

def text_of(html):
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = t.replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", t)

def dims_from_text(t):
    """Common UK phrasings: 'W180 x D40 x H50cm', 'Width 180cm', '180 x 40 x 50 cm'."""
    d = {}
    for letter, key in (("W", "w"), ("D", "d"), ("H", "h")):
        m = re.search(rf"\b{letter}\s*:?\s*{NUM}\s*cm", t, re.I) or \
            re.search(rf"\b{'Width' if letter=='W' else 'Depth' if letter=='D' else 'Height'}\s*:?\s*{NUM}\s*(?:cm)?", t, re.I)
        if m:
            d[key] = float(m.group(1))
    if len(d) < 2:
        m = re.search(rf"{NUM}\s*(?:cm)?\s*[x×]\s*{NUM}\s*(?:cm)?\s*[x×]\s*{NUM}\s*cm", t, re.I)
        if m:
            a, b, c = (float(m.group(i)) for i in (1, 2, 3))
            # widest is width; of the remaining two the smaller is depth
            w = max(a, b, c)
            rest = sorted(x for x in (a, b, c) if x != w) or [0, 0]
            d = {"w": w, "d": rest[0], "h": rest[-1]}
    return d

def bays_from_text(t):
    out = {"open": 0, "door": 0, "drawer": 0}
    for n, word in re.findall(rf"{NUM}\s*(open shelves|open shelf|shelves|shelf|doors|door|drawers|drawer|cupboards|cupboard)", t, re.I):
        wl = word.lower()
        k = "open" if "shel" in wl else "drawer" if "drawer" in wl else "door"
        out[k] = max(out[k], min(int(float(n)), 12))
    words = {"two": 2, "three": 3, "four": 4, "six": 6}
    for wnum, word in re.findall(r"\b(two|three|four|six)\s+(open shelves|shelves|doors|drawers|cupboards)", t, re.I):
        wl = word.lower()
        k = "open" if "shel" in wl else "drawer" if "drawer" in wl else "door"
        out[k] = max(out[k], words[wnum.lower()])
    return out

DELIVERY = {"Oak Furnitureland": 0.0, "Furniture Village": 0.0, "Roseland Furniture": 19.99, "John Lewis": 0.0}

def enrich(retailer, url):
    html = fetch(url)
    if not html:
        return None
    prods = ld_products(html)
    p = prods[0] if prods else {}
    txt = text_of(html)
    name = p.get("name")
    if not name:
        m = re.search(r"<title>(.*?)</title>", html, re.S)
        name = (m.group(1).split("|")[0].strip() if m else None)
    if not name:
        return None

    w, h, d = f(p.get("width")), f(p.get("height")), f(p.get("depth"))
    if not w or not d:
        td = dims_from_text(txt[:60000])
        w, d, h = w or td.get("w"), d or td.get("d"), h or td.get("h")
    if not w:
        return None
    if d and d > w:
        w, d = d, w

    price = price_of(p)
    st = bays_from_text(txt[:60000])
    bays = [{"kind": k, "count": st[k], "widthCm": None, "depthCm": None, "heightCm": None}
            for k in ("open", "door", "drawer") if st[k]]

    rating = p.get("aggregateRating") or {}
    dcost = DELIVERY.get(retailer, 0.0)
    brand = p.get("brand")
    if isinstance(brand, dict):
        brand = brand.get("name")

    return {
        "retailer": retailer, "brand": brand or retailer, "model": name, "product_url": url,
        "price_gbp": price,
        "delivery_cost_gbp": dcost if dcost else "included",
        "landed_cost_gbp": round((price or 0) + dcost, 2) if price else None,
        "arrives_assembled": "yes" if re.search(r"fully assembled|arrives assembled|ready assembled", txt, re.I) else "",
        "mounting": "wall-mounted" if re.search(r"wall[- ]mounted|floating", name, re.I) else "floor",
        "top_width_cm": w, "top_depth_cm": d,
        "overall_width_cm": w, "overall_depth_cm": d, "overall_height_cm": h,
        "bays_json": json.dumps(bays),
        "frame_material": p.get("material") or (
            "Solid oak" if re.search(r"solid oak", txt[:20000], re.I) else
            "Oak veneer" if re.search(r"oak veneer", txt[:20000], re.I) else None),
        "review_score": f(rating.get("ratingValue")), "review_count": f(rating.get("reviewCount")),
        "notes": "Dimensions from the retailer's structured product data. Internal compartment sizes not published.",
    }

if __name__ == "__main__":
    retailer, urlfile, outp = sys.argv[1], sys.argv[2], sys.argv[3]
    urls = [u.strip() for u in open(urlfile) if u.strip().startswith("http")]
    rows, seen = [], set()
    for i, u in enumerate(urls, 1):
        try:
            r = enrich(retailer, u)
        except Exception as e:
            r = None
            print(f"  {i}/{len(urls)} ERR {e}", file=sys.stderr)
        if r and r["model"] not in seen:
            seen.add(r["model"])
            rows.append(r)
            print(f"  {i}/{len(urls)} ok {r['top_width_cm']}x{r['top_depth_cm']} GBP{r['price_gbp']}  {r['model'][:44]}", file=sys.stderr)
        elif r is None:
            print(f"  {i}/{len(urls)} skip (no dims/name)", file=sys.stderr)
        time.sleep(0.3)
    with open(outp, "w") as fo:
        for r in rows:
            fo.write(json.dumps(r) + "\n")
    print(f"\n{retailer}: ENRICHED {len(rows)}", file=sys.stderr)
