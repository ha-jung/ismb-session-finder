import re, json, time, html, urllib.request

BASE = "https://transition.iscb.org/cms_addon/conferences/ismb2026/posters.php"
COMBO_SRC = BASE + "?track=HiTSeq&session=A"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8","replace")

def strip(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()

# 1) enumerate combos from the category menu
menu = fetch(COMBO_SRC)
combos = sorted(set(re.findall(r"\?track=([A-Za-z]+)&session=([A-Z])", menu)))
print("combos:", len(combos))

SESSION_DATE = {"A":"2026-07-13","B":"2026-07-14","C":"2026-07-15","D":"2026-07-16"}

posters = {}
for i,(track,sess) in enumerate(combos):
    url = f"{BASE}?track={track}&session={sess}"
    try:
        page = fetch(url)
    except Exception as e:
        print("  ERR", track, sess, e); continue
    # split into poster blocks
    parts = page.split("<div class='well well-sm'>")
    cnt = 0
    for seg in parts[1:]:
        mnum = re.search(r"<strong>\s*([A-Z]+-\d+):\s*(.*?)</strong>", seg, re.S)
        if not mnum: continue
        num = mnum.group(1).strip()
        title = strip(mnum.group(2))
        mtrack = re.search(r"<strong>Track:</strong>\s*(.*?)</div>", seg, re.S)
        trackname = strip(mtrack.group(1)) if mtrack else ""
        authors = [strip(a) for a in re.findall(r"<li class='author'>(.*?)</li>", seg, re.S)]
        mov = re.search(r"Presentation Overview:</strong>.*?<div style='display:none;'\s*>(.*?)</div>", seg, re.S)
        overview = strip(mov.group(1)) if mov else ""
        posters[num] = {
            "poster": num, "session": num[0] if num[0] in SESSION_DATE else sess,
            "date": SESSION_DATE.get(num[0], SESSION_DATE.get(sess,"")),
            "track": trackname, "title": title,
            "authors": authors, "overview": overview,
        }
        cnt += 1
    print(f"  [{i+1}/{len(combos)}] {track}/{sess}: {cnt} posters (total {len(posters)})")
    time.sleep(0.15)

out = sorted(posters.values(), key=lambda p:(p["poster"]))
json.dump(out, open("posters_all.json","w"), ensure_ascii=False, indent=1)
print("TOTAL unique posters:", len(out))
# sample
for p in out[:2]:
    print("SAMPLE:", p["poster"], "|", p["title"][:60], "| authors:", len(p["authors"]), "| overview chars:", len(p["overview"]))
