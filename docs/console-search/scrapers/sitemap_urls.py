"""Pull product URLs matching a keyword out of a (possibly nested) sitemap."""
import gzip, io, re, subprocess, sys

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

def get(url):
    r = subprocess.run(["curl", "-sL", "-m", "60", "-A", UA, url], capture_output=True)
    b = r.stdout
    if b[:2] == b"\x1f\x8b":
        try:
            b = gzip.decompress(b)
        except Exception:
            pass
    return b.decode("utf8", "replace")

def locs(x):
    return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", x)

def crawl(root, pat, cap=4000, depth=0):
    out, x = [], get(root)
    ls = locs(x)
    children = [l for l in ls if re.search(r"\.xml(\.gz)?$", l)]
    if children and depth < 2:
        for c in children:
            # only descend into sitemaps that plausibly hold products
            if re.search(r"product|item|catalog|pdp|page", c, re.I) or len(children) <= 12:
                out += crawl(c, pat, cap, depth + 1)
                if len(out) >= cap:
                    break
    out += [l for l in ls if re.search(pat, l, re.I) and not re.search(r"\.xml", l)]
    return out[:cap]

if __name__ == "__main__":
    root, pat = sys.argv[1], sys.argv[2]
    u = sorted(set(crawl(root, pat)))
    for x in u:
        print(x)
    print(f"# {len(u)} urls", file=sys.stderr)
