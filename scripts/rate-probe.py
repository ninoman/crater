"""Phase 0 probe: fetch supporter fan pages at the planned pace and log
status codes, rate-limit headers and private/hidden collection markers.

Usage: python3 -I scripts/rate-probe.py tests/fixtures/tralbumcollectors-thumbs-p2.json 50
"""
import html
import json
import random
import re
import sys
import time
import subprocess

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"
WATCH_HEADERS = ("retry-after", "x-ratelimit-limit", "x-ratelimit-remaining", "cf-ray", "server")

supporters = json.load(open(sys.argv[1]))["results"]
limit = int(sys.argv[2])

for i, fan in enumerate(supporters[:limit]):
    url = f"https://bandcamp.com/{fan['username']}"
    started = time.time()
    out = subprocess.run(
        ["curl", "-s", "-A", UA, "-D", "-", "--max-time", "30", url],
        capture_output=True, text=True, errors="replace",
    ).stdout
    head, _, body = out.partition("\n\n")
    status = int(head.split()[1]) if head else 0
    headers = {}
    for line in head.split("\n")[1:]:
        k, _, v = line.partition(":")
        headers[k.strip().lower()] = v.strip()
    elapsed = time.time() - started
    seen = {h: headers.get(h) for h in WATCH_HEADERS if headers.get(h)}
    info = ""
    m = re.search(r'id="pagedata" data-blob="([^"]*)"', body)
    if m:
        d = json.loads(html.unescape(m.group(1)))
        c, w = d.get("collection_data") or {}, d.get("wishlist_data") or {}
        info = (
            f"items={c.get('item_count')} hidden={c.get('hidden_items_count')} "
            f"cache={len((d.get('item_cache') or {}).get('collection') or {})} "
            f"wish={w.get('item_count')} wish_hidden={w.get('hidden')} "
            f"read_only={d.get('fan_read_only')}"
        )
    print(f"{i+1:3d} {status} {elapsed:.2f}s {fan['username']:<28} {info} {seen}", flush=True)
    if status == 429 or status >= 500:
        print("backoff signal, stopping", flush=True)
        break
    time.sleep(random.uniform(1.5, 3.0))
