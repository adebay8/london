"""Pull one product image per URL. JSON-LD Product.image first, og:image as
fallback — between them they cover every retailer in both corpora."""
import csv, json, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

def fetch(url):
    try:
        r = subprocess.run(["curl","-sL","-m","25","-A",UA,"-H","Accept-Language: en-GB,en;q=0.9",url],
                           capture_output=True, text=True, errors="replace")
        return r.stdout or ""
    except Exception:
        return ""

def first_image(html):
    for m in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
        try:
            d = json.loads(m.group(1).strip())
        except Exception:
            continue
        out = []
        def walk(o):
            if isinstance(o, dict):
                t = o.get("@type"); ts = t if isinstance(t, list) else [t]
                if "Product" in ts and o.get("image"):
                    img = o["image"]
                    if isinstance(img, list): img = img[0] if img else None
                    if isinstance(img, dict): img = img.get("url")
                    if isinstance(img, str): out.append(img)
                for v in o.values(): walk(v)
            elif isinstance(o, list):
                for v in o: walk(v)
        walk(d)
        if out: return out[0]
    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html, re.I) or \
        re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html, re.I)
    return m.group(1) if m else None

def norm(u):
    if not u: return None
    if u.startswith("//"): u = "https:" + u
    if not u.startswith("http"): return None
    return u.split("?")[0] if "dunelm.com" not in u else u

def one(url):
    img = norm(first_image(fetch(url)))
    return url, img

def main(csv_in, out_json, workers=6):
    rows = list(csv.DictReader(open(csv_in, encoding="utf-8-sig")))
    urls = [r["product_url"] for r in rows if r.get("product_url", "").startswith("http")]
    urls = list(dict.fromkeys(urls))
    got = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for i, (u, img) in enumerate(ex.map(one, urls), 1):
            if img: got[u] = img
            if i % 25 == 0:
                print(f"  {i}/{len(urls)}  found {len(got)}", file=sys.stderr)
    json.dump(got, open(out_json, "w"), indent=0)
    print(f"{csv_in}: {len(got)}/{len(urls)} images", file=sys.stderr)

main(sys.argv[1], sys.argv[2])
