"""Roseland Furniture — the only retailer in this corpus publishing INTERNAL
compartment dimensions at scale, which is exactly what the PS5 bay gate needs.

Two sources per product: the Shopify .json endpoint for title/price/body, and
the rendered page for the overall H/W/D block.
"""
import json, re, subprocess, sys, time

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

def fetch(url):
    r = subprocess.run(["curl", "-sL", "-m", "40", "-A", UA, url],
                       capture_output=True, text=True, errors="replace")
    return r.stdout or ""

def flat(html):
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t).replace("&amp;", "&").replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", t)

TRIPLE = re.compile(r"([A-Za-z /&'-]{3,40}?):?\s*\(H\)\s*([\d.]+)\s*cm\s*\|\s*\(W\)\s*([\d.]+)\s*cm(?:\s*\|\s*\(D\)\s*([\d.]+)\s*cm)?", re.I)

def kind_of(label):
    l = label.lower()
    if "drawer" in l:
        return "drawer"
    if "cupboard" in l or "internal shelf" in l or "behind" in l or "door" in l:
        return "door"
    if "shelf" in l or "shelves" in l or "compartment" in l or "niche" in l:
        return "open"
    return None

def run(urlfile, outp):
    urls = [u.strip() for u in open(urlfile) if u.strip().startswith("http")]
    rows, seen = [], set()
    for i, u in enumerate(urls, 1):
        j = fetch(u + ".json")
        try:
            p = json.loads(j)["product"]
        except Exception:
            print(f"  {i}/{len(urls)} no json", file=sys.stderr)
            continue
        title = p.get("title") or ""
        if title in seen:
            continue
        variants = p.get("variants") or []
        price = None
        for v in variants:
            try:
                price = float(v["price"]); break
            except Exception:
                pass

        html = fetch(u)
        t = flat(html)
        m = re.search(r"Dimensions\s+Height\s*([\d.]+)\s*cm\s*Width\s*([\d.]+)\s*cm\s*Depth\s*([\d.]+)\s*cm", t, re.I)
        if not m:
            print(f"  {i}/{len(urls)} no overall dims  {title[:44]}", file=sys.stderr)
            time.sleep(0.25)
            continue
        h, w, d = float(m.group(1)), float(m.group(2)), float(m.group(3))

        bays, counts = [], {}
        for label, bh, bw, bd in TRIPLE.findall(t):
            k = kind_of(label)
            if not k:
                continue
            sig = (k, bw, bh, bd)
            if sig in counts:
                continue
            counts[sig] = True
            bays.append({"kind": k, "count": 1, "widthCm": float(bw),
                         "heightCm": float(bh),
                         "depthCm": float(bd) if bd else None})
        # A bare "Cupboard: (H) 33.5cm" style line still tells us closed storage exists.
        if not any(b["kind"] in ("door", "drawer") for b in bays) and re.search(r"cupboard|drawer", t, re.I):
            bays.append({"kind": "door", "count": 1, "widthCm": None, "heightCm": None, "depthCm": None})

        mat = re.search(r"Material:\s*([^|]{3,80}(?:\|[^|]{3,40}){0,4})", t)
        assembled = bool(re.search(r"fully assembled", t, re.I))
        dcost = 19.99 if (price or 0) >= 200 else 12.99
        seen.add(title)
        rows.append({
            "retailer": "Roseland Furniture", "brand": "Roseland", "model": title, "product_url": u,
            "price_gbp": price, "delivery_cost_gbp": dcost,
            "landed_cost_gbp": round((price or 0) + dcost, 2) if price else None,
            "arrives_assembled": "yes" if assembled else "self",
            "mounting": "wall-mounted" if re.search(r"wall|float", title, re.I) else "floor",
            "top_width_cm": w, "top_depth_cm": d,
            "overall_width_cm": w, "overall_depth_cm": d, "overall_height_cm": h,
            "bays_json": json.dumps(bays),
            "frame_material": (mat.group(1).strip() if mat else None),
            "warranty": "12 month guarantee",
            "notes": "Internal compartment sizes published by the retailer.",
        })
        print(f"  {i}/{len(urls)} ok {w}x{d} GBP{price} bays={len(bays)}  {title[:40]}", file=sys.stderr)
        time.sleep(0.25)
    with open(outp, "w") as fo:
        for r in rows:
            fo.write(json.dumps(r) + "\n")
    print(f"\nRoseland ENRICHED {len(rows)}", file=sys.stderr)

run(sys.argv[1], sys.argv[2])
