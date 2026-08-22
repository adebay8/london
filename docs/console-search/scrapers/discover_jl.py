import json, re, subprocess, sys, time
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
def fetch(u):
    r = subprocess.run(["curl","-sL","-m","45","-A",UA,"-H","Accept-Language: en-GB,en;q=0.9",u],
                       capture_output=True, text=True, errors="replace")
    return r.stdout or ""
urls, seen = [], set()
for page in range(1, 7):
    u = f"https://www.johnlewis.com/browse/furniture-lights/living-room/tv-stands/_/N-5pa5?page={page}"
    h = fetch(u)
    m = re.search(r'id="__NEXT_DATA__"[^>]*>(.*?)</script>', h, re.S)
    if not m: 
        print(f"  page {page}: no __NEXT_DATA__", file=sys.stderr); continue
    d = json.loads(m.group(1))
    found = []
    def walk(o):
        if isinstance(o, dict):
            if o.get("productId") and o.get("title"): found.append(o)
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d)
    n = 0
    for p in found:
        pid = p.get("productId")
        if pid in seen: continue
        seen.add(pid)
        urls.append(f"https://www.johnlewis.com/p{pid}")
        n += 1
    print(f"  page {page}: +{n} (total {len(urls)})", file=sys.stderr)
    if n == 0: break
    time.sleep(0.5)
open(sys.argv[1],"w").write("\n".join(urls)+"\n")
print(f"JL urls: {len(urls)}", file=sys.stderr)
