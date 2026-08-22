"""Discover TV-unit products from retailer category pages.

The bed research learned this the hard way: one-product-at-a-time WebFetch
does not scale and most of these retailers 403 it outright. Category pages
served to a browser User-Agent carry the whole page of products as JSON-LD
ItemList, so one request yields 40-60 products instead of one.
"""
import json, re, subprocess, sys, time

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

def fetch(url, timeout=45):
    try:
        r = subprocess.run(
            ["curl", "-sL", "-m", str(timeout), "-A", UA,
             "-H", "Accept-Language: en-GB,en;q=0.9",
             "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
             url],
            capture_output=True, text=True, errors="replace")
        return r.stdout or ""
    except Exception:
        return ""

def jsonld(html):
    for m in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
        raw = m.group(1).strip()
        try:
            yield json.loads(raw)
        except Exception:
            continue

def walk_products(node, out):
    """JSON-LD shapes vary by retailer; find every Product wherever it sits."""
    if isinstance(node, dict):
        t = node.get("@type")
        types = t if isinstance(t, list) else [t]
        if "Product" in types and node.get("name"):
            out.append(node)
        for v in node.values():
            walk_products(v, out)
    elif isinstance(node, list):
        for v in node:
            walk_products(v, out)

def price_of(p):
    o = p.get("offers")
    if isinstance(o, list):
        o = o[0] if o else {}
    if not isinstance(o, dict):
        return None
    for k in ("price", "lowPrice"):
        v = o.get(k)
        if v not in (None, ""):
            try:
                return float(str(v).replace(",", ""))
            except Exception:
                pass
    return None

def rating_of(p):
    r = p.get("aggregateRating") or {}
    if not isinstance(r, dict):
        return None, None
    try:
        score = float(r.get("ratingValue"))
    except Exception:
        score = None
    try:
        count = int(r.get("reviewCount") or r.get("ratingCount"))
    except Exception:
        count = None
    return score, count

def discover(retailer, urls):
    seen, rows = set(), []
    for url in urls:
        html = fetch(url)
        if not html:
            print(f"  [{retailer}] EMPTY {url}", file=sys.stderr)
            continue
        found = []
        for d in jsonld(html):
            walk_products(d, found)
        n_new = 0
        for p in found:
            u = p.get("url") or ""
            if isinstance(u, dict):
                u = u.get("@id", "")
            if not u:
                continue
            if u.startswith("/"):
                u = re.sub(r"(https?://[^/]+).*", r"\1", url) + u
            if u in seen:
                continue
            seen.add(u)
            score, count = rating_of(p)
            rows.append({
                "retailer": retailer, "name": p.get("name"), "url": u,
                "price": price_of(p), "review_score": score, "review_count": count,
                "brand": (p.get("brand") or {}).get("name") if isinstance(p.get("brand"), dict) else p.get("brand"),
            })
            n_new += 1
        print(f"  [{retailer}] {n_new:3} new / {len(found):3} found  {url[:88]}", file=sys.stderr)
        time.sleep(0.6)
    return rows

if __name__ == "__main__":
    targets = json.load(open(sys.argv[1]))
    all_rows = []
    for t in targets:
        all_rows += discover(t["retailer"], t["urls"])
    with open(sys.argv[2], "w") as f:
        for r in all_rows:
            f.write(json.dumps(r) + "\n")
    print(f"\nTOTAL {len(all_rows)} products", file=sys.stderr)
